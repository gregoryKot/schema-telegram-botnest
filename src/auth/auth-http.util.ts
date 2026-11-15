import { UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { opensInFrame } from '../security/embedders';
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
 * Кросс-сайтовая кука партиционирована (CHIPS): живёт в разделе площадки, и её
 * не режет блокировка сторонних кук. `unpartitioned` — только снести пару до CHIPS.
 */
export function cookieOptions(
  maxAgeS: number,
  opts: { crossSite?: boolean; unpartitioned?: boolean } = {},
) {
  return {
    httpOnly: true,
    secure: true,
    sameSite: opts.crossSite ? ('none' as const) : ('strict' as const),
    ...(opts.crossSite && !opts.unpartitioned ? { partitioned: true } : {}),
    path: '/api/auth',
    maxAge: maxAgeS * 1000,
  };
}

/**
 * Метка «сессия живёт в чужом iframe» едет рядом с refresh-кукой тем же
 * SameSite — нужна ротации (`/api/auth/refresh`), иначе она выдала бы куку
 * обратно как `strict`. Держится на сервере, не на заголовке клиента.
 * Значение — поколение пары: 'p' — партиционированная, '1' — до CHIPS.
 */
export const CROSS_SITE_COOKIE = 'refresh_cross';
const CROSS_SITE_MARK = 'p';
const LEGACY_CROSS_SITE_MARK = '1';

export function isCrossSiteSession(req: Request): boolean {
  const mark = getCookie(req, CROSS_SITE_COOKIE);
  return mark === CROSS_SITE_MARK || mark === LEGACY_CROSS_SITE_MARK;
}

/**
 * Кросс-сайтовый ЗАПРОС (для первой выдачи сессии, до метки isCrossSiteSession).
 * Нативный вебвью не шлёт ни Sec-Fetch-Site, ни Origin — strict.
 */
export function isCrossSiteRequest(req: Request, ownOrigin: string): boolean {
  const site = req.headers['sec-fetch-site'];
  if (typeof site === 'string') return site === 'cross-site';
  const origin = req.headers.origin;
  return typeof origin === 'string' && origin !== ownOrigin;
}

/** Sec-Fetch-Site сравнивает инициатора с целью, не с предками iframe: fetch сайта
 * внутри web.telegram.org приходит same-origin — решает и платформа из обмена. */
export function isCrossSiteTelegramLogin(
  req: Request,
  ownOrigin: string,
  platform: unknown,
): boolean {
  return (
    isCrossSiteRequest(req, ownOrigin) || opensInFrame('telegram-web', platform)
  );
}

interface CookieRes {
  cookie(
    name: string,
    value: string,
    opts: ReturnType<typeof cookieOptions>,
  ): void;
  clearCookie(name: string, opts: { path: string }): void;
}

/**
 * Ставит refresh-куку и, для кросс-сайтовых сессий, метку рядом с ней.
 * Кросс-сайтовой паре нужен `req`: пару до CHIPS (метка '1') сносим тем же
 * ответом, иначе браузер держит обе refresh-куки и шлёт первой старую.
 */
export function setRefreshCookie(
  res: CookieRes,
  token: string,
  maxAgeS: number,
  crossSite: false,
): void;
export function setRefreshCookie(
  res: CookieRes,
  token: string,
  maxAgeS: number,
  crossSite: boolean,
  req: Request,
): void;
export function setRefreshCookie(
  res: CookieRes,
  token: string,
  maxAgeS: number,
  crossSite: boolean,
  req?: Request,
): void {
  if (!crossSite) {
    res.cookie(REFRESH_COOKIE, token, cookieOptions(maxAgeS));
    // Обычный вход в том же браузере вытесняет прежнюю кросс-сайтовую сессию —
    // метка не должна пережить её и ослабить следующую куку.
    res.clearCookie(CROSS_SITE_COOKIE, { path: '/api/auth' });
    return;
  }
  // Только по метке '1': без неё на этом месте может лежать strict-сессия сайта.
  if (req && getCookie(req, CROSS_SITE_COOKIE) === LEGACY_CROSS_SITE_MARK) {
    const legacy = cookieOptions(0, { crossSite, unpartitioned: true });
    res.clearCookie(REFRESH_COOKIE, legacy);
    res.clearCookie(CROSS_SITE_COOKIE, legacy);
  }
  const opts = cookieOptions(maxAgeS, { crossSite });
  res.cookie(REFRESH_COOKIE, token, opts);
  res.cookie(CROSS_SITE_COOKIE, CROSS_SITE_MARK, opts);
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
