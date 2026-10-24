import { NotFoundException } from '@nestjs/common';

/**
 * Результат updateMany/deleteMany с `userId` в WHERE: ноль затронутых строк —
 * это «чужая или несуществующая запись», а не успех. Раньше такой запрос
 * отвечал 200 (C-8, аудит 2026-10), и по ответу нельзя было отличить удаление
 * от попытки трогать чужое. Тот же 404, что у phrase-check.service.ts.
 */
export async function requireAffected(
  op: PromiseLike<{ count: number }>,
  what = 'Entry',
): Promise<{ count: number }> {
  const res = await op;
  if (res.count === 0) throw new NotFoundException(`${what} not found`);
  return res;
}

interface OwnedDeleteDelegate {
  deleteMany(args: {
    where: { id: number; userId: bigint };
  }): PromiseLike<{ count: number }>;
}

/** deleteMany по (id, userId) с 404, если строки нет или она чужая. */
export function deleteOwned(
  delegate: OwnedDeleteDelegate,
  id: number,
  userId: bigint,
  what = 'Entry',
): Promise<{ count: number }> {
  return requireAffected(delegate.deleteMany({ where: { id, userId } }), what);
}
