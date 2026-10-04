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
