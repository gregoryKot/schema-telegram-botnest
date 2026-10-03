// Короткий код, который человек сверяет глазами между экраном и карточкой бота.
import { randomInt } from 'crypto';

// Без похожих начертаний (0/O, 1/I/L) — код читают с экрана и сверяют глазами.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const USER_CODE_LENGTH = 8;

export function newUserCode(): string {
  let out = '';
  for (let i = 0; i < USER_CODE_LENGTH; i++) {
    out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return out;
}

/**
 * Что снести перед выпиской нового билета. Протухшие — всегда, а прежний
 * билет ЭТОГО аккаунта гасим: иначе код, забытый на другом экране, остаётся
 * годным для подтверждения. У входа (requesterUserId === null) гасить по
 * хозяину нечего — иначе условие `{ userId: null }` снесло бы чужие билеты
 * всех анонимов разом.
 */
export function staleTicketsWhere(requesterUserId: bigint | null) {
  const stale = { expiresAt: { lt: new Date() } };
  return requesterUserId ? { OR: [{ userId: requesterUserId }, stale] } : stale;
}
