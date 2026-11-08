import type { PrismaService } from '../prisma/prisma.service';
import {
  decryptRecord,
  encryptRecord,
  unreadableFields,
} from '../utils/crypto';

/**
 * Добавляет id в зашифрованный json-массив профиля (mySchemaIds/myModeIds),
 * если его там ещё нет. Заполненная карточка = id в списке (инвариант, правило
 * №4): иначе архив «Мои записи» её не найдёт.
 */
export async function addToMyList(
  prisma: PrismaService,
  userId: bigint,
  field: 'mySchemaIds' | 'myModeIds',
  id: string,
): Promise<void> {
  // Read-modify-write по денормализованному зашифрованному списку (аудит
  // 2026-07, 2.2). Одной транзакции READ COMMITTED мало: две карточки одного
  // юзера читали список параллельно, и вторая запись теряла id первой (E15,
  // аудит 2026-11). Замок строки пользователя: вторая ждёт коммита первой и
  // читает список уже с её id. Шифротекст не дописать в SQL — только так.
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT 1 FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
    const row = await tx.user.findUnique({
      where: { id: userId },
      select: { [field]: true },
    });
    if (!row) return;
    const dec = decryptRecord(row as Record<string, unknown>, {
      model: 'user',
      jsonArrays: [field],
    });
    // Нечитаемый список (ключ не подошёл) приходит как `[]`, а не строкой:
    // `[id]` поверх него затёр бы живой, но сейчас нечитаемый список. Он
    // восстановится из карточек (noteBackedLists), когда ключи починят.
    if (unreadableFields(dec).includes(field)) return;
    const list = Array.isArray(dec[field]) ? (dec[field] as string[]) : [];
    if (list.includes(id)) return;
    const enc = encryptRecord(
      { [field]: [...list, id] },
      { jsonArrays: [field] },
    );
    await tx.user.update({ where: { id: userId }, data: enc });
  });
}
