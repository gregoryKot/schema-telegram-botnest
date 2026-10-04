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

/** POST /api/auth/email/consume. Любой сбой → { kind: 'error', reason }. */
export async function consumeEmailToken(
  apiBase: string,
  token: string,
): Promise<EmailConsumeOutcome> {
  try {
    const res = await fetch(`${apiBase}/api/auth/email/consume`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'x-requested-with': 'webapp',
      },
      body: JSON.stringify({ token }),
    });
    const body = (await res.json().catch(() => ({}))) as ConsumeBody;
    if (!res.ok) {
      // email_link_session / email_taken несёт сам сервер; прочее — просрочка.
      const known = body.reason === 'email_link_session' || body.reason === 'email_taken';
      return { kind: 'error', reason: known ? String(body.reason) : EXPIRED };
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
  } catch {
    return { kind: 'error', reason: EXPIRED };
  }
}

/**
 * Куда вести после погашения. Билет входа (`ticket`) сессию сам не одобряет:
 * человека ведём на экран сверки (device-code phishing, 2026-08-31), а токен
 * едет во фрагменте — AuthConfirmPage забирает его оттуда.
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
        ? `/auth/confirm?code=${encodeURIComponent(ticket)}` +
            `#access_token=${outcome.accessToken}&expires_in=${outcome.expiresIn}`
        : (returnTo ?? '/today');
    case 'error':
      // Ссылка привязки открыта не в том браузере / адрес занят — на аккаунт,
      // там для этих кодов есть своя подсказка (emailLinkError.ts).
      return outcome.reason === EXPIRED
        ? `/auth/error?reason=${EXPIRED}`
        : `/account?error=${outcome.reason}`;
  }
}
