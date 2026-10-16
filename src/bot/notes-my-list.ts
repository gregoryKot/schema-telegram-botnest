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
  // Read-modify-write по денормализованному зашифрованному списку — в
  // транзакции (аудит 2026-07, 2.2): конкурентные upsert'ы разных карточек
  // одного юзера гонялись за одним прочитанным списком → lost update.
  await prisma.$transaction(async (tx) => {
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
