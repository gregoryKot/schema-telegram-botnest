// Код привязки почты — пара к ссылке из того же письма.
//
// Зачем. Ссылка привязки работает только в браузере, где открыт аккаунт (A3,
// аудит 2026-10). Человек, у которого приложение открыто ВНУТРИ Telegram или
// MAX, открывает письмо в почтовой программе, ссылка уходит в системный
// браузер — а там его сессии нет, и привязка не срабатывала никогда. С 2026-11
// входа через Telegram на сайте нет (запрос Роскомнадзора), и почта для таких
// людей — способ попасть на сайт, поэтому путь обязан работать: код из письма
// вводится на том же экране, где привязку запросили (там сессия есть).
//
// Защита та же, что у ссылки: нужны и сессия аккаунта, и содержимое ящика.
// Код считается из хеша токена — отдельной колонки и секрета не нужно: кто
// читает письмо, у того и ссылка; кто читает БД, тому код ни к чему без сессии.
import { createHash, timingSafeEqual } from 'crypto';

// Тот же алфавит, что у кода билета (ticket-user-code.ts): без 0/O/1/I/L.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const EMAIL_LINK_CODE_LENGTH = 8;

/** Код по хешу токена (тому, что лежит в EmailToken.tokenHash). */
export function emailLinkCode(tokenHash: string): string {
  const digest = createHash('sha256')
    .update(`email-link-code:${tokenHash}`)
    .digest();
  let out = '';
  for (let i = 0; i < EMAIL_LINK_CODE_LENGTH; i++) {
    out += ALPHABET[digest[i] % ALPHABET.length];
  }
  return out;
}

/** Код для письма — по сырому токену из ссылки. */
export function emailLinkCodeForLink(link: string): string {
  const raw = new URL(link).searchParams.get('token') ?? '';
  return emailLinkCode(createHash('sha256').update(raw).digest('hex'));
}

/** Как код показан в письме: `K7M2-QX94`, как код билета на экранах. */
export const showEmailLinkCode = (code: string): string =>
  `${code.slice(0, 4)}-${code.slice(4)}`;

export function emailLinkCodeMatches(
  tokenHash: string,
  typed: string,
): boolean {
  const a = Buffer.from(emailLinkCode(tokenHash));
  const b = Buffer.from(typed.trim().toUpperCase());
  return a.length === b.length && timingSafeEqual(a, b);
}
