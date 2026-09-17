import { Logger, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { getCookie } from './auth-http.util';
import { isRedirectedHost } from '../infra/canonical-host';
import { hasLoopGuardMarker, withLoopGuardMarker } from './oauth-loop-guard';

// 2026-09-08: кука oauth_state должна жить на хосте КОЛБЭКА — редиректим на
// него ДО куки (ниже), причину mismatch классифицируем. 2026-09-16: если сам
// колбэк ведёт на редиректуемый хост (legacy/www) — цикл с main.ts, гард ниже.

export const OAUTH_STATE_COOKIE = 'oauth_state';
export const OAUTH_COOKIE_PATH = '/api/auth';

const logger = new Logger('OAuthHost');

/** Единые опции куки шага OAuth-редиректа (oauth_state, tg_pkce_verifier). */
export function setOAuthCookie(
  res: Response,
  name: string,
  value: string,
): void {
  res.cookie(name, value, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000,
    path: OAUTH_COOKIE_PATH,
  });
}

/** Хост запроса из заголовка Host (как в src/main.ts — не req.hostname). */
export function requestHost(req: Request): string {
  return (req.headers.host ?? '').toLowerCase();
}

/**
 * Не на хосте колбэка → 302 туда же, true; на хосте/без Host → false. Хост
 * колбэка сам подлежит редиректу (была бы петля) → false + error-лог.
 */
export function redirectToCallbackHost(
  req: Request,
  res: Response,
  callbackOrigin: string,
): boolean {
  const host = requestHost(req);
  if (!host) return false;
  const callbackHost = new URL(callbackOrigin).host.toLowerCase();
  if (host === callbackHost) return false;
  if (isRedirectedHost(callbackHost)) {
    logger.error(
      `адрес возврата OAuth ведёт на перенаправляемый хост ${callbackHost} — вход зациклился бы: GOOGLE_REDIRECT_URI/VK_REDIRECT_URI указывают не на канонический хост`,
    );
    return false;
  }
  if (hasLoopGuardMarker(req.originalUrl)) return false;
  res.redirect(302, withLoopGuardMarker(`${callbackOrigin}${req.originalUrl}`));
  return true;
}

/** Double-submit-проверка state; не совпало — throw с классифицированной причиной. */
export function assertOAuthStateMatches(
  req: Request,
  state: string,
  callbackOrigin: string,
): void {
  const saved = getCookie(req, OAUTH_STATE_COOKIE);
  if (saved === state) return;

  if (!saved) {
    const callbackHost = new URL(callbackOrigin).host.toLowerCase();
    if (requestHost(req) !== callbackHost) {
      throw new UnauthorizedException(
        'OAuth state mismatch: кука не пришла — колбэк на чужом хосте',
      );
    }
    throw new UnauthorizedException(
      'OAuth state mismatch: кука не пришла — истекла (10 минут) или вход начат в другом браузере',
    );
  }
  throw new UnauthorizedException(
    'OAuth state mismatch: кука от другого запуска входа (второе окно входа)',
  );
}
