import { BadRequestException } from '@nestjs/common';

const INT64_MAX = 9_223_372_036_854_775_807n;

/**
 * Парсит id ПОЛЬЗОВАТЕЛЯ (User.id = BigInt) из path-параметра. Возвращает
 * bigint, а не `number`: веб-аккаунты (Google/VK/MAX/почта) живут в диапазоне
 * [1e15, 9e15) (пин 2^53 в user-id-range.spec.ts), `parseId` его не берёт, а
 * `Number(id)` при расширении диапазона ударил бы в чужую строку (X-1).
 *
 * Только цифры, до 19 знаков, без нуля, мусора, пробелов и экспоненты;
 * значение за int64 Postgres всё равно не примет — 400 вместо 500.
 * `allowNegative` — как у parseId: виртуальные клиенты терапевта кодируются
 * -TherapyRelation.id (Int-колонка, в bigint он просто мал).
 *
 * Для id Int-колонок (noteId, taskId, mapId, modeId…) остаётся `parseId`.
 */
export function parseUserId(
  raw: string,
  opts: { allowNegative?: boolean } = {},
): bigint {
  const re = opts.allowNegative ? /^-?\d{1,19}$/ : /^\d{1,19}$/;
  if (typeof raw !== 'string' || !re.test(raw)) {
    throw new BadRequestException('Invalid id');
  }
  const n = BigInt(raw);
  if (n === 0n || n > INT64_MAX || n < -INT64_MAX) {
    throw new BadRequestException('Invalid id');
  }
  return n;
}

/**
 * Путь `:clientId` therapy-эндпоинтов: id клиента-пользователя (bigint) или
 * отрицательный id виртуального (офлайн) клиента = -TherapyRelation.id.
 */
export const parseClientId = (raw: string): bigint =>
  parseUserId(raw, { allowNegative: true });
