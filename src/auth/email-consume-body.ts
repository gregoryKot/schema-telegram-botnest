import type { Response } from 'express';
import type { EmailConsumeResult } from './email-token.service';
import { setRefreshCookie } from './auth-http.util';

/**
 * Тело ответа POST /api/auth/email/consume. Три исхода, различаются по ключу:
 * - `accessToken` — сессия выдана (refresh-кука уже в ответе);
 * - `challengeToken` — у аккаунта включён TOTP, страница ведёт на /auth/2fa;
 * - `linked` — почта привязана к уже открытому аккаунту, сессия не выдаётся.
 */
export type EmailConsumeBody =
  | { accessToken: string; expiresIn: number }
  | { challengeToken: string }
  | { linked: true };

export function emailConsumeBody(
  r: EmailConsumeResult,
  res: Pick<Response, 'cookie' | 'clearCookie'>,
): EmailConsumeBody {
  if (r.kind === 'linked') return { linked: true };
  // 2FA-гейт (H1): login при включённом TOTP → экран ввода кода, не сессия.
  if (r.kind === 'totp_challenge') return { challengeToken: r.challengeToken };
  setRefreshCookie(res, r.tokens.refreshToken, 30 * 24 * 3600, false);
  return { accessToken: r.tokens.accessToken, expiresIn: r.tokens.expiresIn };
}
