// Адрес возврата для ссылки из письма (E14, аудит 2026-11). Сайт держит его в
// sessionStorage вкладки (returnTo.ts), а письмо открывают НОВОЙ вкладкой —
// человек попадал на «Сегодня». Теперь путь уходит с запросом письма
// (POST /api/auth/email/link, поле returnTo) и возвращается в ссылке
// (/auth/callback?return_to=…), а после погашения проверяется ещё раз
// (safeReturnPath): параметр в адресе собирает кто угодно.
//
// Правило пути — копия бэкендового (src/auth/email-link-params.ts: DTO
// отвергает чужое 400-м). Расхождение уронило бы вход по почте целиком, поэтому
// сайт шлёт только то, что сервер примет, а сверку держит returnTo.sync.test.ts.
import { peekReturnTo, safeReturnPath } from './returnTo';

export const EMAIL_RETURN_PARAM = 'return_to';
export const EMAIL_RETURN_TO_MAX = 512;
export const EMAIL_RETURN_TO_RE = /^(?!.*\/\/)\/[^\s\p{Cc}\\]*$/u;

/** Что положить в запрос письма: запомненный путь, если сервер его примет. */
export function returnToForEmailLink(): string | undefined {
  const path = peekReturnTo();
  if (!path || path.length > EMAIL_RETURN_TO_MAX || !EMAIL_RETURN_TO_RE.test(path)) return undefined;
  return path;
}

/** Куда вести после погашения: путь из ссылки письма, иначе запомненный во вкладке. */
export function emailReturnPath(fromLink: string | null, fromTab: string | null): string | null {
  return safeReturnPath(fromLink) ?? fromTab;
}
