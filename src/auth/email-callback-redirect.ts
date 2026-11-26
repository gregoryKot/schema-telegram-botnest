// Куда уводит GET /api/auth/email/callback — ссылка из письма привязки почты.
//
// Аудит 2026-10, B-14: раньше этот GET сам погашал токен и ставил куку сессии.
// Почтовые сканеры, превью ссылок в мессенджерах и антивирусы открывают ссылки
// из писем раньше человека — и крали вход (или сжигали одноразовый токен).
// Теперь GET ничего не гасит: он только уводит на страницу сайта, а страница
// сама шлёт POST /api/auth/email/consume. Сканер GET-а не выполняет скрипты,
// POST ему недоступен.
//
// Страница живёт на /auth/callback (его уже обслуживает AuthCallback, рядом с
// приёмом токена после OAuth): новый роут потребовал бы правки App.tsx.
// Отличие — параметр `email_token`.
//
// Побочно уходит прежний «отскок» (email-link-bounce.ts): ссылка привязки
// требовала живой refresh-куки, а на переход с чужого сайта SameSite=strict её
// не отдаёт. POST со страницы нашего же сайта — same-site, кука едет сама.

/** Путь страницы-погашения и имя параметра с токеном (общие с webapp). */
export const EMAIL_CONSUME_PATH = '/auth/callback';
export const EMAIL_CONSUME_PARAM = 'email_token';

/** Куда вести браузер со ссылки из письма. Токен НЕ погашается. */
export function emailCallbackRedirectUrl(
  frontendBase: string,
  rawToken: unknown,
): string {
  const base = frontendBase.replace(/\/$/, '');
  // Нет токена (или их два: ?token=a&token=b) — экран ошибки, а не пустая страница.
  if (typeof rawToken !== 'string' || !rawToken) {
    return `${base}/auth/error?reason=email_link_expired`;
  }
  const q = new URLSearchParams({ [EMAIL_CONSUME_PARAM]: rawToken });
  return `${base}${EMAIL_CONSUME_PATH}?${q.toString()}`;
}
