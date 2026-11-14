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
// броском, если после удаления не осталось входа.
import { ConflictException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { inSerializableTx } from '../prisma/serializable-retry';
import { isTelegramUserId } from './user-id-range';

// Текст идёт на экран как есть (humanizeResponseError пропускает русский):
// английская строка подменялась общим «Не удалось отвязать способ входа», и
// человек не узнавал причину (QA 2026-11, М2).
export const LAST_METHOD_MESSAGE =
  'После отвязки в аккаунт будет не войти. Сначала нужно привязать VK ID или Яндекс ID.';

/**
 * Чем входят: VK ID и Яндекс ID — на сайте, Telegram и MAX — внутри мессенджера.
 * Почта (вход отключён, ч. 10 ст. 8 149-ФЗ) и Google входом не считаются.
 * Копия — webapp/src/pages/account/accountMethods.ts (сверка — accountMethods.test.ts).
 */
export const LOGIN_PROVIDERS: readonly string[] = [
  'vk',
  'yandex',
  'telegram',
  'max',
];

/** Останется ли вход: строка из LOGIN_PROVIDERS или номер из Telegram (входит через бота и без строки). */
function keepsLogin(
  userId: bigint,
  rows: Array<{ provider: string }>,
): boolean {
  return (
    isTelegramUserId(userId) ||
    rows.some((r) => LOGIN_PROVIDERS.includes(r.provider))
  );
}

export async function unlinkProviderSafely(
  prisma: PrismaService,
  userId: bigint,
  provider: string,
): Promise<void> {
  await inSerializableTx(
    prisma,
    async (tx) => {
      const all = await tx.authProvider.findMany({
        where: { userId },
        select: { id: true, provider: true },
      });
      const victims = all.filter((r) => r.provider === provider);
      // Все строки провайдера уходят разом (две строки одного провайдера — тоже).
      const rest = all.filter((r) => r.provider !== provider);
      if (!keepsLogin(userId, rest)) {
        throw new ConflictException(LAST_METHOD_MESSAGE);
      }
      if (victims.length === 0) return;
      await tx.authProvider.deleteMany({
        where: { id: { in: victims.map((r) => r.id) } },
      });
      // Откат броском: если после удаления входа не осталось — не коммитим.
      const left = await tx.authProvider.findMany({
        where: { userId },
        select: { provider: true },
      });
      if (!keepsLogin(userId, left)) {
        throw new ConflictException(LAST_METHOD_MESSAGE);
      }
    },
    () =>
      new ConflictException('Способы входа менялись одновременно — повторите'),
  );
}
