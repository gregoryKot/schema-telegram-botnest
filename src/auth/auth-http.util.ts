import { UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { SecurityLogService } from './security-log.service';

export const REFRESH_COOKIE = 'refresh_token';
const CSRF_HEADER = 'x-requested-with';

export function hasCsrfHeader(req: Request): boolean {
  // Primary: x-requested-with (our fetch calls). Fallback: application/json
  // content-type — cross-origin forms can't set it without a CORS preflight
  // that we reject; proxies may strip x-requested-with, never Content-Type.
  const v = req.headers?.[CSRF_HEADER];
  if (typeof v === 'string' && v.length > 0) return true;
  const ct = String(req.headers?.['content-type'] ?? '');
  return ct.startsWith('application/json');
}

/**
 * Куки сессии. По умолчанию `SameSite=strict` (часть CSRF-защиты сайта).
 * `crossSite` — для мессенджеров, открывающих мини-приложение в iframe (MAX,
 * Telegram Web): чужой iframe strict-куку не шлёт вовсе, сессия молча
 * переставала бы продлеваться. От CSRF при этом держит `requireCsrf`.
 */
export function cookieOptions(
  maxAgeS: number,
  opts: { crossSite?: boolean } = {},
) {
  return {
    httpOnly: true,
    secure: true,
    sameSite: opts.crossSite ? ('none' as const) : ('strict' as const),
    path: '/api/auth',
    maxAge: maxAgeS * 1000,
  };
}

/**
 * Метка «сессия живёт в чужом iframe» едет рядом с refresh-кукой тем же
 * SameSite — нужна ротации (`/api/auth/refresh`), иначе она выдала бы куку
 * обратно как `strict`. Держится на сервере, не на заголовке клиента.
 */
export const CROSS_SITE_COOKIE = 'refresh_cross';

export function isCrossSiteSession(req: Request): boolean {
  return getCookie(req, CROSS_SITE_COOKIE) === '1';
}

/**
 * Кросс-сайтовый ЗАПРОС (для первой выдачи сессии, до метки isCrossSiteSession):
 * Telegram Web грузит мини-апп в iframe как MAX — нужен `crossSite:true` уже
 * на логине (2026-08-21). Нативный вебвью не шлёт ни то, ни другое — strict.
 */
export function isCrossSiteRequest(req: Request, ownOrigin: string): boolean {
  const site = req.headers['sec-fetch-site'];
  if (typeof site === 'string') return site === 'cross-site';
  const origin = req.headers.origin;
  return typeof origin === 'string' && origin !== ownOrigin;
}

/** Ставит refresh-куку и, для кросс-сайтовых сессий, метку рядом с ней. */
export function setRefreshCookie(
  res: {
    cookie(
      name: string,
      value: string,
      opts: ReturnType<typeof cookieOptions>,
    ): void;
    clearCookie(name: string, opts: { path: string }): void;
  },
  token: string,
  maxAgeS: number,
  crossSite: boolean,
): void {
  res.cookie(REFRESH_COOKIE, token, cookieOptions(maxAgeS, { crossSite }));
  if (crossSite) {
    res.cookie(CROSS_SITE_COOKIE, '1', cookieOptions(maxAgeS, { crossSite }));
  } else {
    // Обычный вход в том же браузере вытесняет прежнюю кросс-сайтовую сессию —
    // метка не должна пережить её и ослабить следующую куку.
    res.clearCookie(CROSS_SITE_COOKIE, { path: '/api/auth' });
  }
}

// express типизирует Request.cookies как any — читаем куки через одну
// типобезопасную обёртку вместо россыпи unsafe-обращений по контроллеру.
export function getCookie(req: Request, name: string): string | undefined {
  const jar = req.cookies as Record<string, string | undefined> | undefined;
  return jar?.[name];
}

export function requireCsrf(
  req: Request,
  endpoint: string,
  securityLog: SecurityLogService,
): void {
  if (!hasCsrfHeader(req)) {
    securityLog.log('csrf_blocked', {
      endpoint,
      ip: req.ip,
      ua: (req.headers['user-agent'] ?? '').slice(0, 80),
    });
    throw new UnauthorizedException('Missing CSRF header');
  }
}
