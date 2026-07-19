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

export function cookieOptions(maxAgeS: number) {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'strict' as const,
    path: '/api/auth',
    maxAge: maxAgeS * 1000,
  };
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
