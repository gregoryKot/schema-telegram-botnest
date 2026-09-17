// Юнит-тесты стирания refresh-куки (refresh-cookie.ts). Разбор 2026-09-03:
// 401 на /api/auth/refresh не чистил куку — клиент считал сессию мёртвой и
// уходил на экран входа, а мёртвая кука оставалась в jar и предъявлялась
// снова при каждом visibilitychange/cold start.
import { UnauthorizedException } from '@nestjs/common';
import { CROSS_SITE_COOKIE, REFRESH_COOKIE } from './auth-http.util';
import { clearCookies, clearCookiesOnAuthFailure } from './refresh-cookie';

function makeRes() {
  return { clearCookie: jest.fn() };
}

describe('clearCookies', () => {
  it('стирает и refresh-куку, и метку кросс-сайтовой сессии', () => {
    const res = makeRes();
    clearCookies(res);
    expect(res.clearCookie).toHaveBeenCalledWith(REFRESH_COOKIE, {
      path: '/api/auth',
    });
    expect(res.clearCookie).toHaveBeenCalledWith(CROSS_SITE_COOKIE, {
      path: '/api/auth',
    });
  });
});

describe('clearCookiesOnAuthFailure', () => {
  it('UnauthorizedException → чистит куки И пробрасывает исходную ошибку', () => {
    const res = makeRes();
    const err = new UnauthorizedException('dead session');
    expect(() => clearCookiesOnAuthFailure(res, err)).toThrow(err);
    expect(res.clearCookie).toHaveBeenCalledWith(
      REFRESH_COOKIE,
      expect.objectContaining({ path: '/api/auth' }),
    );
  });

  it('НЕ-Unauthorized ошибка (500) → куки НЕ трогает, пробрасывает как есть', () => {
    const res = makeRes();
    const err = new Error('db down');
    expect(() => clearCookiesOnAuthFailure(res, err)).toThrow(err);
    expect(res.clearCookie).not.toHaveBeenCalled();
  });
});
