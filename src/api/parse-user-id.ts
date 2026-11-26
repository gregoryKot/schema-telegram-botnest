import { BadRequestException } from '@nestjs/common';

const INT64_MAX = 9_223_372_036_854_775_807n;
const INT32_MAX = 2_147_483_647n;

/**
 * Парсит id ПОЛЬЗОВАТЕЛЯ (User.id = BigInt) из path-параметра. Возвращает
 * bigint, а не `number`: веб-аккаунты (Google/VK/MAX/почта) живут в диапазоне
 * [1e15, 9e15) (пин 2^53 в user-id-range.spec.ts), `parseId` его не берёт, а
 * `Number(id)` при расширении диапазона ударил бы в чужую строку (X-1).
 * Только цифры, до 19 знаков, без нуля, мусора, пробелов и экспоненты;
 * значение за int64 Postgres всё равно не примет — 400 вместо 500.
 * `allowNegative` — офлайн-клиенты (parseClientId). Int-колонки — `parseId`.
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
 * `:clientId` therapy-эндпоинтов: id пользователя или -TherapyRelation.id
 * офлайн-клиента — Int-колонка: модуль за 2^31-1 → 400, не 500 (S18).
 */
export function parseClientId(raw: string): bigint {
  const n = parseUserId(raw, { allowNegative: true });
  if (n < -INT32_MAX) throw new BadRequestException('Invalid id');
  return n;
}
