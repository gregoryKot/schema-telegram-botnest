// Погашение ссылки из письма (B-14 аудита 2026-10). GET /api/auth/email/callback
// токен не гасит — он только уводит сюда (/auth/callback?email_token=…), а
// гасит эта страница POST-ом: почтовые сканеры и превью ссылок скрипты не
// исполняют, поэтому сессию и одноразовый токен они больше не забирают.
// Серверная сторона: src/auth/email-consume-body.ts, email-callback-redirect.ts.

export type EmailConsumeOutcome =
  | { kind: 'session'; accessToken: string; expiresIn: number }
  | { kind: 'twofa'; challengeToken: string }
  | { kind: 'linked' }
  | { kind: 'error'; reason: string };

interface ConsumeBody {
  accessToken?: unknown;
  expiresIn?: unknown;
  challengeToken?: unknown;
  linked?: unknown;
  reason?: unknown;
}

const EXPIRED = 'email_link_expired';
// U6 (аудит 2026-11): сеть и сбой сервера читались как «ссылка устарела».
const NETWORK = 'email_network';
/** Сеть, лимит, сбой сервера: ссылка цела — повтор с тем же токеном на месте. */
export const canRetryEmailConsume = (reason: string) => reason === NETWORK || /^http_(429|5\d\d)$/.test(reason);
/** Коды с подсказкой на «Аккаунте» (emailLinkError.ts), а не на /auth/error. */
const ACCOUNT_REASONS = new Set(['email_link_session', 'email_taken']);

/** POST /api/auth/email/consume. Любой сбой → { kind: 'error', reason }. */
export async function consumeEmailToken(
  apiBase: string,
  token: string,
): Promise<EmailConsumeOutcome> {
  let res: Response;
  try {
    res = await fetch(`${apiBase}/api/auth/email/consume`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'x-requested-with': 'webapp',
      },
      body: JSON.stringify({ token }),
    });
  } catch {
    return { kind: 'error', reason: NETWORK }; // запрос не дошёл: ссылка цела
  }
  const body = (await res.json().catch(() => ({}))) as ConsumeBody;
  if (!res.ok) {
    const reason = String(body.reason);
    if (ACCOUNT_REASONS.has(reason)) return { kind: 'error', reason };
    if (res.status === 429 || res.status >= 500) return { kind: 'error', reason: `http_${res.status}` }; // не про ссылку
    return { kind: 'error', reason: EXPIRED };
  }
  if (typeof body.challengeToken === 'string')
    return { kind: 'twofa', challengeToken: body.challengeToken };
  if (body.linked === true) return { kind: 'linked' };
  if (typeof body.accessToken === 'string')
    return {
      kind: 'session',
      accessToken: body.accessToken,
      expiresIn: typeof body.expiresIn === 'number' ? body.expiresIn : 900,
    };
  return { kind: 'error', reason: EXPIRED };
}

/**
 * Куда вести после погашения. Билет входа (`ticket`) сессию сам не одобряет:
 * человека ведём на экран сверки (device-code phishing, 2026-08-31). Токена в
 * адресе нет: EmailTokenConsume уже положил его в AuthProvider, а фрагмент
 * AuthConfirmPage не читает (login-CSRF, аудит 2026-11).
 */
export function emailConsumeNextPath(
  outcome: EmailConsumeOutcome,
  ticket: string | null,
  returnTo: string | null,
): string {
  switch (outcome.kind) {
    case 'twofa':
      return `/auth/2fa?token=${encodeURIComponent(outcome.challengeToken)}`;
    case 'linked':
      return '/account?linked=email';
    case 'session':
      return ticket
        ? `/auth/confirm?code=${encodeURIComponent(ticket)}`
        : (returnTo ?? '/today');
    case 'error':
      return ACCOUNT_REASONS.has(outcome.reason)
        ? `/account?error=${outcome.reason}`
        : `/auth/error?reason=${outcome.reason}`;
  }
}
