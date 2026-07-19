// auth-http.util.ts — общие CSRF/cookie-примитивы, на которые опирается
// csrf.invariants.spec.ts (трипваер по исходникам контроллеров). Здесь —
// юнит-тесты самого поведения: hasCsrfHeader/requireCsrf по факту режут
// запрос без x-requested-with и без application/json, cookieOptions отдаёт
// httpOnly/sameSite:strict флаги, getCookie безопасно читает jar.
import { UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import {
  REFRESH_COOKIE,
  hasCsrfHeader,
  cookieOptions,
  getCookie,
  requireCsrf,
} from './auth-http.util';
import { SecurityLogService } from './security-log.service';

function makeRequest(opts: {
  headers?: Record<string, string | undefined>;
  cookies?: Record<string, string | undefined>;
  ip?: string;
}): Request {
  return {
    headers: opts.headers ?? {},
    cookies: opts.cookies,
    ip: opts.ip,
  } as unknown as Request;
}

describe('REFRESH_COOKIE', () => {
  it('имя куки стабильно (контракт с контроллерами/фронтом)', () => {
    expect(REFRESH_COOKIE).toBe('refresh_token');
  });
});

describe('hasCsrfHeader', () => {
  it('x-requested-with непустой → true', () => {
    const req = makeRequest({
      headers: { 'x-requested-with': 'XMLHttpRequest' },
    });
    expect(hasCsrfHeader(req)).toBe(true);
  });

  it('x-requested-with пустая строка → не считается заголовком, идём в fallback', () => {
    const req = makeRequest({
      headers: { 'x-requested-with': '', 'content-type': 'application/json' },
    });
    expect(hasCsrfHeader(req)).toBe(true); // спасает JSON-fallback
  });

  it('Content-Type: application/json без x-requested-with → true (fallback)', () => {
    const req = makeRequest({
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
    expect(hasCsrfHeader(req)).toBe(true);
  });

  it('ни заголовка, ни JSON content-type → false', () => {
    const req = makeRequest({
      headers: { 'content-type': 'text/plain' },
    });
    expect(hasCsrfHeader(req)).toBe(false);
  });

  it('заголовки вовсе отсутствуют → false, не падает', () => {
    const req = { headers: {} } as unknown as Request;
    expect(hasCsrfHeader(req)).toBe(false);
  });

  it('x-requested-with как массив (не строка) → игнорируется, смотрим на content-type', () => {
    const req = {
      headers: {
        'x-requested-with': ['XMLHttpRequest'],
        'content-type': 'multipart/form-data',
      },
    } as unknown as Request;
    expect(hasCsrfHeader(req)).toBe(false);
  });
});

describe('cookieOptions', () => {
  it('httpOnly/secure/sameSite:strict/path фиксированы, maxAge переводится в мс', () => {
    const opts = cookieOptions(30 * 24 * 3600);
    expect(opts).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/api/auth',
      maxAge: 30 * 24 * 3600 * 1000,
    });
  });

  it('maxAge=0 → корректный ноль, не falsy-баг', () => {
    expect(cookieOptions(0).maxAge).toBe(0);
  });
});

describe('getCookie', () => {
  it('кука есть → возвращает значение', () => {
    const req = makeRequest({
      cookies: { [REFRESH_COOKIE]: 'raw-token-value' },
    });
    expect(getCookie(req, REFRESH_COOKIE)).toBe('raw-token-value');
  });

  it('кука отсутствует в jar → undefined', () => {
    const req = makeRequest({ cookies: { other: 'x' } });
    expect(getCookie(req, REFRESH_COOKIE)).toBeUndefined();
  });

  it('jar вовсе не распарсен (cookie-parser выключен) → undefined, не падает', () => {
    const req = makeRequest({});
    expect(getCookie(req, REFRESH_COOKIE)).toBeUndefined();
  });
});

describe('requireCsrf', () => {
  function makeSecurityLog(): SecurityLogService {
    return { log: jest.fn() } as unknown as SecurityLogService;
  }

  it('x-requested-with присутствует → не бросает, securityLog не зовётся', () => {
    const req = makeRequest({
      headers: { 'x-requested-with': 'XMLHttpRequest' },
    });
    const securityLog = makeSecurityLog();
    expect(() =>
      requireCsrf(req, '/api/auth/refresh', securityLog),
    ).not.toThrow();
    expect(securityLog.log).not.toHaveBeenCalled();
  });

  it('заголовок отсутствует → бросает UnauthorizedException и логирует csrf_blocked', () => {
    const req = makeRequest({
      headers: { 'user-agent': 'curl/8.0' },
      ip: '203.0.113.5',
    });
    const securityLog = makeSecurityLog();
    expect(() => requireCsrf(req, '/api/auth/logout', securityLog)).toThrow(
      UnauthorizedException,
    );
    expect(securityLog.log).toHaveBeenCalledWith('csrf_blocked', {
      endpoint: '/api/auth/logout',
      ip: '203.0.113.5',
      ua: 'curl/8.0',
    });
  });

  it('user-agent длиннее 80 символов обрезается в аудит-логе', () => {
    const longUa = 'A'.repeat(200);
    const req = makeRequest({ headers: { 'user-agent': longUa } });
    const securityLog = makeSecurityLog();
    expect(() => requireCsrf(req, '/api/auth/refresh', securityLog)).toThrow(
      UnauthorizedException,
    );
    const call = (securityLog.log as jest.Mock).mock.calls[0][1] as {
      ua: string;
    };
    expect(call.ua).toHaveLength(80);
  });

  it('user-agent отсутствует → в логе пустая строка, не "undefined"', () => {
    const req = makeRequest({ headers: {} });
    const securityLog = makeSecurityLog();
    expect(() => requireCsrf(req, '/api/auth/refresh', securityLog)).toThrow(
      UnauthorizedException,
    );
    expect(securityLog.log).toHaveBeenCalledWith(
      'csrf_blocked',
      expect.objectContaining({ ua: '' }),
    );
  });
});
