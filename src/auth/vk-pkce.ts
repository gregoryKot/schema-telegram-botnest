import { UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import * as crypto from 'crypto';
import { getCookie } from './auth-http.util';
import { OAUTH_COOKIE_PATH, setOAuthCookie } from './oauth-host';

// PKCE-верификатор входа через VK ID — случайный и живёт в httpOnly-куке шага
// 1 (аудит 2026-11, S21). До этого он выводился из state:
// HMAC(JWT_SECRET, state), а state не секрет — он едет в адресе authorize и
// колбэка, оседает в истории и логах прокси. Секретность держал один ключ на
// все входы. Кука ставится через setOAuthCookie (oauth-host.ts: хост колбэка,
// путь /api/auth, 10 минут, httpOnly) — так же, как oauth_state, поэтому
// переживает и соседний инстанс, и деплой (инцидент 2026-10-03: verifier в
// памяти процесса терялся, вход падал vk_failed).

export const VK_PKCE_COOKIE = 'vk_pkce';
/** RFC 7636: 43..128 знаков из [A-Za-z0-9-._~]; у нас — base64url. */
const VERIFIER_RE = /^[A-Za-z0-9_-]{43,128}$/;

/** Шаг 1: новый verifier (32 случайных байта → 43 знака) в куку шага OAuth. */
export function issueVkPkceVerifier(res: Response): string {
  const verifier = crypto.randomBytes(32).toString('base64url');
  setOAuthCookie(res, VK_PKCE_COOKIE, verifier);
  return verifier;
}

/** Шаг 2: verifier из куки; кука стирается. Нет или не по формату — отказ. */
export function takeVkPkceVerifier(req: Request, res: Response): string {
  const verifier = getCookie(req, VK_PKCE_COOKIE);
  res.clearCookie(VK_PKCE_COOKIE, { path: OAUTH_COOKIE_PATH });
  if (!verifier || !VERIFIER_RE.test(verifier)) {
    throw new UnauthorizedException(
      'VK PKCE: кука верификатора не пришла — истекла (10 минут) или вход начат в другом браузере',
    );
  }
  return verifier;
}

/** S256: code_challenge = base64url(sha256(verifier)). */
export function pkceChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}
