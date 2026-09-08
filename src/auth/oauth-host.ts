import { UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { getCookie } from './auth-http.util';

// 2026-09-08: вход через Google падал с «OAuth state mismatch». Причина —
// сайт целиком (включая /login и /api/auth/*) обслуживается ещё и с
// домена-алиаса (kotlarewski.gr, см. ALIAS_DOMAINS в app.module.ts), а
// провайдер всегда возвращает колбэк на КАНОНИЧЕСКИЙ хост (redirect_uri).
// Кука oauth_state ставится на хосте, где открыт /api/auth/<provider> — если
// это алиас, колбэк на каноническом хосте её просто не увидит. Решение —
// редиректить на хост колбэка ДО того, как кука выставлена (см. ниже). Заодно
// отказ входа теперь классифицирован: раньше «mismatch» не говорил, кука
// отсутствовала или отличалась и на каком хосте пришёл колбэк.

export const OAUTH_STATE_COOKIE = 'oauth_state';
export const OAUTH_COOKIE_PATH = '/api/auth';

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
 * Если запрос пришёл НЕ на хост колбэка (origin redirect_uri провайдера) —
 * 302 на тот же путь+query на каноническом origin и вернуть true. Иначе
 * false, ничего не делает. Пустой Host → false (не редиректить в никуда).
 */
export function redirectToCallbackHost(
  req: Request,
  res: Response,
  callbackOrigin: string,
): boolean {
  const host = requestHost(req);
  if (!host) return false;
  const callbackHost = new URL(callbackOrigin).host;
  if (host === callbackHost.toLowerCase()) return false;
  res.redirect(302, `${callbackOrigin}${req.originalUrl}`);
  return true;
}

/**
 * Double-submit-проверка state. Совпало — ничего не делает. Не совпало —
 * бросает UnauthorizedException с классифицированным сообщением (см.
 * инвариант первого аргумента лога в client-errors.controller.ts — сюда
 * попадают только фиксированные строки ниже, никакого текста клиента).
 */
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
