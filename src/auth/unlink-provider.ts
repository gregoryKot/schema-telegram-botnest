// Отвязка способа входа без риска остаться совсем без входа (аудит 2026-10).
//
// Раньше: `findMany` → «больше одного?» → `deleteMany({ userId, provider })` без
// транзакции. Две параллельные отвязки РАЗНЫХ провайдеров обе видели «два
// способа» и обе удаляли — на выходе ноль, аккаунт недоступен. Тот же исход
// у двух строк одного провайдера (`email`): `deleteMany` по имени уносил обе.
//
// Теперь одна транзакция уровня Serializable (Postgres SSI): из двух
// конкурентных отвязок, читающих и пишущих одни и те же строки, ровно одна
// проходит, вторая получает P2034 и перечитывает состояние — уже с одним
// способом, то есть Conflict. READ COMMITTED здесь не годился: повторная
// проверка внутри транзакции не видит чужого незакоммиченного удаления.
// Внутри ещё два рубежа: удаляем по id конкретных строк и откатываемся
// броском, если после удаления не осталось ни одного способа входа.
import { ConflictException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';

const LAST_METHOD_MESSAGE = 'Cannot unlink the only authentication method';
const SERIALIZATION_RETRIES = 3;

function isSerializationFailure(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === 'P2034';
}

export async function unlinkProviderSafely(
  prisma: PrismaService,
  userId: bigint,
  provider: string,
): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await prisma.$transaction(
        async (tx) => {
          const all = await tx.authProvider.findMany({
            where: { userId },
            select: { id: true, provider: true },
          });
          if (all.length <= 1) throw new ConflictException(LAST_METHOD_MESSAGE);
          const victims = all.filter((r) => r.provider === provider);
          // Отвязка снесла бы ВСЕ способы входа (две строки одного провайдера).
          if (victims.length >= all.length) {
            throw new ConflictException(LAST_METHOD_MESSAGE);
          }
          if (victims.length === 0) return;
          await tx.authProvider.deleteMany({
            where: { id: { in: victims.map((r) => r.id) } },
          });
          // Откат броском: если после удаления входа не осталось — не коммитим.
          const left = await tx.authProvider.count({ where: { userId } });
          if (left < 1) throw new ConflictException(LAST_METHOD_MESSAGE);
        },
        { isolationLevel: 'Serializable' },
      );
      return;
    } catch (err) {
      if (!isSerializationFailure(err)) throw err;
      if (attempt >= SERIALIZATION_RETRIES) {
        throw new ConflictException(
          'Способы входа менялись одновременно — повторите',
        );
      }
    }
  }
}
