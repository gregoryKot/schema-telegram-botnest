import { UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { SecurityLogService } from './security-log.service';

export const REFRESH_COOKIE = 'refresh_token';
const CSRF_HEADER = 'x-requested-with';

export function hasCsrfHeader(req: Request): boolean {
  // Primary check: x-requested-with header set by our webapp fetch calls.
  const v = req.headers?.[CSRF_HEADER];
  if (typeof v === 'string' && v.length > 0) return true;
  // Fallback: Content-Type: application/json is also CSRF-safe.
  // Cross-origin form submissions cannot set this content-type without
  // triggering a CORS preflight, which our server rejects for unknown origins.
  // Reverse proxies (e.g. Amvera load balancer) may strip x-requested-with,
  // but they never strip Content-Type — it's required for request parsing.
  const ct = String(req.headers?.['content-type'] ?? '');
  return ct.startsWith('application/json');
}

/**
 * Куки сессии. По умолчанию `SameSite=strict` — это часть защиты сайта от
 * CSRF, и трогать её глобально нельзя.
 *
 * `crossSite` — для мессенджера, который открывает мини-приложение в iframe
 * (так делает MAX, в отличие от нативного вебвью Telegram). В чужом iframe
 * браузер strict-куку не отправляет вовсе: пользователь вошёл бы по подписи,
 * а через 15 минут сессия молча перестала бы продлеваться. Ослабление точечное
 * — только для сессий, выпущенных обменом подписи мессенджера; от CSRF их
 * держит заголовок (`requireCsrf`), а не SameSite.
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
 * Метка «сессия живёт в чужом iframe», едет рядом с refresh-кукой и тем же
 * SameSite. Нужна из-за ротации: `/api/auth/refresh` перевыпускает куку, и без
 * метки он выдал бы её обратно как `strict` — сессия в MAX сломалась бы на
 * первом же продлении, через 15 минут после входа.
 *
 * Метка держится на сервере, а не на заголовке от клиента: инвариант «эта
 * сессия кросс-сайтовая» не должен зависеть от того, вспомнил ли о нём
 * очередной вызывающий.
 */
export const CROSS_SITE_COOKIE = 'refresh_cross';

export function isCrossSiteSession(req: Request): boolean {
  return getCookie(req, CROSS_SITE_COOKIE) === '1';
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
