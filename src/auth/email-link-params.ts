// Что едет в ссылке из письма кроме токена: билет входа и адрес возврата.
//
// Адрес возврата (E14, аудит 2026-11): сайт держит его в sessionStorage
// вкладки, а письмо открывают НОВОЙ вкладкой — человек попадал на «Сегодня».
// Теперь путь едет в самой ссылке: POST email/link → письмо → GET
// email/callback → /auth/callback?return_to=… (email-callback-redirect.ts).
//
// Только свой путь: с `/`, без `//` (протокол-относительный адрес, в том числе
// после схлопывания `/..//`), без `\`, пробелов и управляющих символов
// (браузер читает `\` как `/` и вырезает табы: `/\t/evil.com` — это
// `//evil.com`). Копия правила на сайте — webapp/src/auth/returnTo.ts, сверка —
// webapp/src/auth/returnTo.sync.test.ts (правило №4). Сайт проверяет адрес
// ещё раз после погашения (safeReturnPath): параметр в адресе собирает кто угодно.

export const RETURN_TO_PARAM = 'return_to';
export const RETURN_TO_MAX = 512;
export const RETURN_TO_RE = /^(?!.*\/\/)\/[^\s\p{Cc}\\]*$/u;

export interface MagicLinkParams {
  /** Билет входа: сессию заберёт устройство, начавшее вход (2026-08-28). */
  ticket?: string;
  returnTo?: string;
}

/** Адрес возврата из запроса — только свой путь, иначе undefined. */
export function safeReturnTo(raw: unknown): string | undefined {
  if (typeof raw !== 'string' || raw.length > RETURN_TO_MAX) return undefined;
  return RETURN_TO_RE.test(raw) ? raw : undefined;
}

/** Query ссылки из письма (GET /api/auth/email/callback). */
export function emailLinkQuery(token: string, extra: MagicLinkParams): string {
  const q = new URLSearchParams({ token });
  if (extra.ticket) q.set('ticket', extra.ticket);
  const returnTo = safeReturnTo(extra.returnTo);
  if (returnTo) q.set(RETURN_TO_PARAM, returnTo);
  return q.toString();
}
