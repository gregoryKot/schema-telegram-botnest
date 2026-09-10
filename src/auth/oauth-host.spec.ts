// РЕГРЕССИЯ 2026-09-08: вход через Google падал с «OAuth state mismatch»,
// когда начат на домене-алиасе (kotlarewski.gr) — колбэк всегда приходит на
// канонический хост, и кука, поставленная на алиасе, там не видна. Этот файл
// покрывает три чистые функции, которые решают проблему: редирект на хост
// колбэка ДО выставления куки (redirectToCallbackHost) и классификацию
// причины mismatch (assertOAuthStateMatches), плюс единые опции куки.
import { UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  OAUTH_STATE_COOKIE,
  OAUTH_COOKIE_PATH,
  setOAuthCookie,
  requestHost,
  redirectToCallbackHost,
  assertOAuthStateMatches,
} from './oauth-host';

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    cookies: {},
    originalUrl: '/api/auth/google?ticket=K7M2QX94',
    ...overrides,
  } as unknown as Request;
}

function makeRes(): Response & { redirect: jest.Mock; cookie: jest.Mock } {
  return {
    redirect: jest.fn(),
    cookie: jest.fn(),
  } as unknown as Response & { redirect: jest.Mock; cookie: jest.Mock };
}

describe('setOAuthCookie', () => {
  it('httpOnly/secure/sameSite lax/path /api/auth/maxAge 10 минут', () => {
    const res = makeRes();
    setOAuthCookie(res, OAUTH_STATE_COOKIE, 'value-1');
    expect(res.cookie).toHaveBeenCalledWith('oauth_state', 'value-1', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 600_000,
      path: OAUTH_COOKIE_PATH,
    });
  });
});

describe('requestHost', () => {
  it('читает из заголовка Host, в нижнем регистре', () => {
    const req = makeReq({ headers: { host: 'SchemeHappens.ru' } });
    expect(requestHost(req)).toBe('schemehappens.ru');
  });

  it('пустой Host → пустая строка', () => {
    expect(requestHost(makeReq())).toBe('');
  });
});

describe('redirectToCallbackHost', () => {
  const ORIGIN = 'https://schemehappens.ru';

  it('запрос с домена-алиаса → 302 на тот же путь+query на каноническом origin, вернул true', () => {
    const req = makeReq({ headers: { host: 'kotlarewski.gr' } });
    const res = makeRes();
    const result = redirectToCallbackHost(req, res, ORIGIN);
    expect(result).toBe(true);
    expect(res.redirect).toHaveBeenCalledWith(
      302,
      'https://schemehappens.ru/api/auth/google?ticket=K7M2QX94',
    );
  });

  it('запрос уже на каноническом хосте → false, редирект не вызывается', () => {
    const req = makeReq({ headers: { host: 'schemehappens.ru' } });
    const res = makeRes();
    expect(redirectToCallbackHost(req, res, ORIGIN)).toBe(false);
    expect(res.redirect).not.toHaveBeenCalled();
  });

  it('Host отсутствует → false (не редиректить в никуда)', () => {
    const req = makeReq();
    const res = makeRes();
    expect(redirectToCallbackHost(req, res, ORIGIN)).toBe(false);
    expect(res.redirect).not.toHaveBeenCalled();
  });

  it('регистр Host не важен для сравнения — совпадает с каноническим', () => {
    const req = makeReq({ headers: { host: 'SchemeHappens.ru' } });
    const res = makeRes();
    expect(redirectToCallbackHost(req, res, ORIGIN)).toBe(false);
    expect(res.redirect).not.toHaveBeenCalled();
  });
});

describe('assertOAuthStateMatches', () => {
  const ORIGIN = 'https://schemehappens.ru';

  it('кука совпадает со state → не бросает', () => {
    const req = makeReq({
      headers: { host: 'schemehappens.ru' },
      cookies: { [OAUTH_STATE_COOKIE]: 'state-1' },
    });
    expect(() => assertOAuthStateMatches(req, 'state-1', ORIGIN)).not.toThrow();
  });

  it('куки нет, хост запроса ≠ хост callbackOrigin → «колбэк на чужом хосте»', () => {
    const req = makeReq({ headers: { host: 'kotlarewski.gr' }, cookies: {} });
    expect(() => assertOAuthStateMatches(req, 'state-1', ORIGIN)).toThrow(
      UnauthorizedException,
    );
    expect(() => assertOAuthStateMatches(req, 'state-1', ORIGIN)).toThrow(
      'OAuth state mismatch: кука не пришла — колбэк на чужом хосте',
    );
  });

  it('куки нет, хост канонический → «истекла или вход начат в другом браузере»', () => {
    const req = makeReq({
      headers: { host: 'schemehappens.ru' },
      cookies: {},
    });
    expect(() => assertOAuthStateMatches(req, 'state-1', ORIGIN)).toThrow(
      'OAuth state mismatch: кука не пришла — истекла (10 минут) или вход начат в другом браузере',
    );
  });

  it('кука есть, но отличается → «второе окно входа»', () => {
    const req = makeReq({
      headers: { host: 'schemehappens.ru' },
      cookies: { [OAUTH_STATE_COOKIE]: 'other-state' },
    });
    expect(() => assertOAuthStateMatches(req, 'state-1', ORIGIN)).toThrow(
      'OAuth state mismatch: кука от другого запуска входа (второе окно входа)',
    );
  });

  it('кука есть и совпадает, но хост чужой → НЕ бросает (проверка только по куке)', () => {
    const req = makeReq({
      headers: { host: 'kotlarewski.gr' },
      cookies: { [OAUTH_STATE_COOKIE]: 'state-1' },
    });
    expect(() => assertOAuthStateMatches(req, 'state-1', ORIGIN)).not.toThrow();
  });
});
