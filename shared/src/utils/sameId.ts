import type { UserId } from '../userId';

/**
 * Сравнение id пользователей, пришедших из разных мест (ответ API — число или
 * строка, параметр маршрута — всегда строка). `===` между `5` и `'5'` — false,
 * а `==`/`Number()` для веб-id (> 2^53) округляют и склеивают соседние аккаунты
 * (аудит 2026-10, X-1) — поэтому сравнение идёт по десятичной записи.
 * null/undefined не равны ничему, в том числе друг другу.
 */
export function sameId(
  a: UserId | null | undefined,
  b: UserId | null | undefined,
): boolean {
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

/** Виртуальный (офлайн) клиент терапевта: id = -TherapyRelation.id < 0. */
export function isVirtualId(id: UserId): boolean {
  return String(id).startsWith('-');
}

/**
 * `:clientId` из адреса (`/cabinet/:clientId`) → id или null. Строка остаётся
 * строкой: `parseInt` на веб-id (> 2^53) округляет, и кабинет открывал бы
 * «соседнего» клиента (аудит 2026-10, X-1). Мусор и пустое — null.
 */
export function parseRouteUserId(
  raw: string | undefined | null,
): string | null {
  return raw && /^-?\d{1,19}$/.test(raw) ? raw : null;
}

/**
 * Стабильный «номер корзины» 0..n-1 по id — для цвета аватара и т.п. Как
 * `Math.abs(id) % n`, но точен и для веб-id (> 2^53), где Number теряет цифры.
 */
export function idBucket(id: UserId, n: number): number {
  const v = BigInt(String(id));
  return Number((v < 0n ? -v : v) % BigInt(n));
}
