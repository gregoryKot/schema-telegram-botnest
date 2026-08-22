// auth-http.util.ts — общие CSRF/cookie-примитивы, на которые опирается
// csrf.invariants.spec.ts (трипваер по исходникам контроллеров). Здесь —
// юнит-тесты самого поведения: hasCsrfHeader/requireCsrf по факту режут
// запрос без x-requested-with и без application/json, cookieOptions отдаёт
// httpOnly/sameSite:strict флаги, getCookie безопасно читает jar.
import { UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import {
  CROSS_SITE_COOKIE,
  REFRESH_COOKIE,
  hasCsrfHeader,
  cookieOptions,
  getCookie,
  isCrossSiteRequest,
  isCrossSiteSession,
  requireCsrf,
  setRefreshCookie,
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

// Мессенджер MAX открывает мини-апп в чужом iframe, откуда браузер не шлёт
// strict-куку. Сессия там держится на SameSite=None, и главное — это свойство
// обязано пережить ротацию токена: без метки /api/auth/refresh выдал бы куку
// обратно как strict, и вход в MAX умирал бы через 15 минут после логина.
describe('кросс-сайтовая сессия (iframe MAX)', () => {
  function makeRes() {
    const cookie = jest.fn();
    const clearCookie = jest.fn();
    return { cookie, clearCookie, res: { cookie, clearCookie } };
  }

  it('crossSite → SameSite=none и метка рядом с refresh-кукой', () => {
    const { cookie, res } = makeRes();
    setRefreshCookie(res, 'tok', 100, true);

    expect(cookie).toHaveBeenCalledWith(
      REFRESH_COOKIE,
      'tok',
      expect.objectContaining({ sameSite: 'none', secure: true }),
    );
    expect(cookie).toHaveBeenCalledWith(
      CROSS_SITE_COOKIE,
      '1',
      expect.objectContaining({ sameSite: 'none' }),
    );
  });

  it('обычная сессия → strict, метка гасится, а не наследуется', () => {
    const { cookie, clearCookie, res } = makeRes();
    setRefreshCookie(res, 'tok', 100, false);

    expect(cookie).toHaveBeenCalledWith(
      REFRESH_COOKIE,
      'tok',
      expect.objectContaining({ sameSite: 'strict' }),
    );
    expect(cookie).not.toHaveBeenCalledWith(
      CROSS_SITE_COOKIE,
      expect.anything(),
      expect.anything(),
    );
    // Иначе прежняя метка пережила бы вход с сайта и ослабила его куку.
    expect(clearCookie).toHaveBeenCalledWith(CROSS_SITE_COOKIE, {
      path: '/api/auth',
    });
  });

  it('метка читается из запроса — по ней refresh не понижает сессию до strict', () => {
    expect(
      isCrossSiteSession(
        makeRequest({ cookies: { [CROSS_SITE_COOKIE]: '1' } }),
      ),
    ).toBe(true);
    expect(isCrossSiteSession(makeRequest({ cookies: {} }))).toBe(false);
    // Чужое значение меткой не считается.
    expect(
      isCrossSiteSession(
        makeRequest({ cookies: { [CROSS_SITE_COOKIE]: 'yes' } }),
      ),
    ).toBe(false);
  });

  it('ротация сохраняет кросс-сайтовость: что пришло, то и выдаётся', () => {
    const req = makeRequest({ cookies: { [CROSS_SITE_COOKIE]: '1' } });
    const { cookie, res } = makeRes();
    setRefreshCookie(res, 'rotated', 100, isCrossSiteSession(req));

    expect(cookie).toHaveBeenCalledWith(
      REFRESH_COOKIE,
      'rotated',
      expect.objectContaining({ sameSite: 'none' }),
    );
  });
});

// isCrossSiteRequest определяет кросс-сайтовость ПЕРВОГО запроса (до того,
// как есть метка isCrossSiteSession) — Telegram Web грузит мини-апп в iframe,
// как MAX; нативный вебвью Telegram остаётся на strict (2026-08-21).
describe('isCrossSiteRequest', () => {
  const OWN = 'https://schemehappens.ru';

  it('Sec-Fetch-Site: cross-site → true (главный сигнал)', () => {
    const req = makeRequest({ headers: { 'sec-fetch-site': 'cross-site' } });
    expect(isCrossSiteRequest(req, OWN)).toBe(true);
  });

  it('Sec-Fetch-Site: same-origin → false, даже если Origin отличается (заголовок приоритетнее)', () => {
    const req = makeRequest({
      headers: { 'sec-fetch-site': 'same-origin', origin: 'https://evil.example' },
    });
    expect(isCrossSiteRequest(req, OWN)).toBe(false);
  });

  it('нет Sec-Fetch-Site, Origin ≠ наш → true (фолбэк для браузеров без заголовка)', () => {
    const req = makeRequest({ headers: { origin: 'https://web.telegram.org' } });
    expect(isCrossSiteRequest(req, OWN)).toBe(true);
  });

  it('нет Sec-Fetch-Site, Origin === наш → false', () => {
    const req = makeRequest({ headers: { origin: OWN } });
    expect(isCrossSiteRequest(req, OWN)).toBe(false);
  });

  it('ни Sec-Fetch-Site, ни Origin (нативный вебвью Telegram) → false, остаётся strict', () => {
    const req = makeRequest({ headers: {} });
    expect(isCrossSiteRequest(req, OWN)).toBe(false);
  });

  it('Sec-Fetch-Site как массив (не строка) → игнорируется, смотрим на Origin', () => {
    const req = {
      headers: {
        'sec-fetch-site': ['cross-site'],
        origin: 'https://web.telegram.org',
      },
    } as unknown as Request;
    expect(isCrossSiteRequest(req, OWN)).toBe(true);
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
