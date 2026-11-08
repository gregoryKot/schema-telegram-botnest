// PKCE-верификатор VK в куке шага 1 (аудит 2026-11, S21): раньше он
// выводился из state, который виден в адресе. Кука ставится через
// oauth-host.ts (setOAuthCookie) — те же опции, что у oauth_state.
import { UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  VK_PKCE_COOKIE,
  issueVkPkceVerifier,
  pkceChallenge,
  takeVkPkceVerifier,
} from './vk-pkce';

const res = () => ({ cookie: jest.fn(), clearCookie: jest.fn() });
const req = (cookies: Record<string, string> = {}) =>
  ({ cookies }) as unknown as Request;

describe('issueVkPkceVerifier', () => {
  it('43 знака base64url в httpOnly secure-куке на /api/auth, 10 минут', () => {
    const r = res();
    const v = issueVkPkceVerifier(r as unknown as Response);
    expect(v).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(r.cookie).toHaveBeenCalledWith(VK_PKCE_COOKIE, v, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 600_000,
      path: '/api/auth',
    });
  });

  it('каждый раз новый', () => {
    const seen = new Set(
      Array.from({ length: 20 }, () =>
        issueVkPkceVerifier(res() as unknown as Response),
      ),
    );
    expect(seen.size).toBe(20);
  });
});

describe('takeVkPkceVerifier', () => {
  it('отдаёт verifier из куки и стирает куку', () => {
    const r = res();
    const v = 'a'.repeat(43);
    expect(
      takeVkPkceVerifier(
        req({ [VK_PKCE_COOKIE]: v }),
        r as unknown as Response,
      ),
    ).toBe(v);
    expect(r.clearCookie).toHaveBeenCalledWith(VK_PKCE_COOKIE, {
      path: '/api/auth',
    });
  });

  it.each([
    ['куки нет', {}],
    ['короче 43', { [VK_PKCE_COOKIE]: 'a'.repeat(42) }],
    ['чужие символы', { [VK_PKCE_COOKIE]: `${'a'.repeat(42)}.` }],
  ])('%s → Unauthorized, кука всё равно стирается', (_, cookies) => {
    const r = res();
    expect(() =>
      takeVkPkceVerifier(req(cookies), r as unknown as Response),
    ).toThrow(UnauthorizedException);
    expect(r.clearCookie).toHaveBeenCalled();
  });
});

describe('pkceChallenge', () => {
  it('RFC 7636, приложение B: S256 от эталонного verifier', () => {
    expect(pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
  });
});
