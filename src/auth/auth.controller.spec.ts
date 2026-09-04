// AuthController — refresh/logout/me/link-token, до этого теста без покрытия
// совсем. Стиль — как auth-oauth.controller.spec.ts: контроллер
// инстанцируется напрямую, зависимости — typed test doubles. Приоритет:
// CSRF-гейт на refresh/logout, cross-site cookie переживает ротацию,
// logout?all=true не роняет запрос на уже невалидном refresh-токене.
import { UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthController } from './auth.controller';
import type { AuthService } from './auth.service';
import type { SecurityLogService } from './security-log.service';
import type { TotpService } from './totp.service';
import { REFRESH_COOKIE, CROSS_SITE_COOKIE } from './auth-http.util';

interface AuthMocks {
  rotateRefreshToken: jest.Mock;
  verifyAccessToken: jest.Mock;
  revokeAllSessions: jest.Mock;
  revokeSession: jest.Mock;
  getUserProviders: jest.Mock;
  buildLinkToken: jest.Mock;
}

function makeAuth(): { auth: AuthService; mocks: AuthMocks } {
  const mocks: AuthMocks = {
    rotateRefreshToken: jest.fn(),
    verifyAccessToken: jest.fn(),
    revokeAllSessions: jest.fn().mockResolvedValue(undefined),
    revokeSession: jest.fn().mockResolvedValue(undefined),
    getUserProviders: jest.fn().mockResolvedValue([]),
    buildLinkToken: jest.fn().mockReturnValue('link-token-1'),
  };
  return { auth: mocks as unknown as AuthService, mocks };
}

function makeController(auth: AuthService) {
  const securityLog = { log: jest.fn() } as unknown as SecurityLogService;
  const totp = {
    getStatus: jest
      .fn()
      .mockResolvedValue({ enabled: false, recoveryCodesLeft: 0 }),
  } as unknown as TotpService;
  return new AuthController(auth, securityLog, totp);
}

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: { 'x-requested-with': 'fetch' },
    cookies: {},
    ip: '1.2.3.4',
    ...overrides,
  } as unknown as Request;
}

function makeRes(): {
  res: Response;
  mocks: { cookie: jest.Mock; clearCookie: jest.Mock };
} {
  const mocks = { cookie: jest.fn(), clearCookie: jest.fn() };
  return { res: mocks as unknown as Response, mocks };
}

describe('AuthController.refresh', () => {
  it('без CSRF-заголовка → UnauthorizedException, rotateRefreshToken не вызывается', async () => {
    const { auth, mocks } = makeAuth();
    const controller = makeController(auth);
    const req = makeReq({ headers: {} });
    const { res } = makeRes();

    await expect(controller.refresh(req, res)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(mocks.rotateRefreshToken).not.toHaveBeenCalled();
  });

  it('без refresh-куки → UnauthorizedException("No refresh token")', async () => {
    const { auth } = makeAuth();
    const controller = makeController(auth);
    const req = makeReq({ cookies: {} });
    const { res } = makeRes();

    await expect(controller.refresh(req, res)).rejects.toThrow(
      'No refresh token',
    );
  });

  it('успешная ротация: возвращает accessToken/expiresIn, ставит НЕ-кросс-сайтовую куку (strict)', async () => {
    const { auth, mocks } = makeAuth();
    mocks.rotateRefreshToken.mockResolvedValue({
      accessToken: 'acc-1',
      refreshToken: 'ref-2',
      expiresIn: 900,
      rotated: true,
    });
    const controller = makeController(auth);
    const req = makeReq({ cookies: { [REFRESH_COOKIE]: 'ref-1' } });
    const { res, mocks: resMocks } = makeRes();

    const result = await controller.refresh(req, res);

    expect(result).toEqual({ accessToken: 'acc-1', expiresIn: 900 });
    expect(mocks.rotateRefreshToken).toHaveBeenCalledWith(
      'ref-1',
      '1.2.3.4',
      undefined,
    );
    expect(resMocks.cookie).toHaveBeenCalledWith(
      REFRESH_COOKIE,
      'ref-2',
      expect.objectContaining({ sameSite: 'strict' }),
    );
  });

  it('кросс-сайтовая сессия (метка cookie) переживает ротацию — новая refresh-кука SameSite=none', async () => {
    const { auth, mocks } = makeAuth();
    mocks.rotateRefreshToken.mockResolvedValue({
      accessToken: 'acc-1',
      refreshToken: 'ref-2',
      expiresIn: 900,
      rotated: true,
    });
    const controller = makeController(auth);
    const req = makeReq({
      cookies: { [REFRESH_COOKIE]: 'ref-1', [CROSS_SITE_COOKIE]: '1' },
    });
    const { res, mocks: resMocks } = makeRes();

    await controller.refresh(req, res);

    expect(resMocks.cookie).toHaveBeenCalledWith(
      REFRESH_COOKIE,
      'ref-2',
      expect.objectContaining({ sameSite: 'none' }),
    );
    expect(resMocks.cookie).toHaveBeenCalledWith(
      CROSS_SITE_COOKIE,
      '1',
      expect.objectContaining({ sameSite: 'none' }),
    );
  });

  // Пункт 2 диагностики 2026-08-21: частая ротация одной сессии — источник
  // гонки (см. refresh-rotation.ts). rotated:false → сервис отдаёт тот же
  // refreshToken, что пришёл, и контроллер обязан НЕ трогать Set-Cookie —
  // иначе TTL куки продлевался бы на каждой загрузке страницы почём зря.
  // Разбор 2026-09-03: 401 на refresh раньше не чистил куку — клиент считает
  // 401 окончательной смертью сессии (уходит на экран входа), а мёртвая кука
  // оставалась в jar и предъявлялась снова при каждом открытии приложения.
  it('rotateRefreshToken бросил 401 → куки стираются, ошибка пробрасывается', async () => {
    const { auth, mocks } = makeAuth();
    mocks.rotateRefreshToken.mockRejectedValue(
      new UnauthorizedException('Refresh token already used or expired'),
    );
    const controller = makeController(auth);
    const req = makeReq({ cookies: { [REFRESH_COOKIE]: 'dead-cookie' } });
    const { res, mocks: resMocks } = makeRes();

    await expect(controller.refresh(req, res)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(resMocks.clearCookie).toHaveBeenCalledWith(REFRESH_COOKIE, {
      path: '/api/auth',
    });
    expect(resMocks.clearCookie).toHaveBeenCalledWith(CROSS_SITE_COOKIE, {
      path: '/api/auth',
    });
  });

  it('rotateRefreshToken упал НЕ-Unauthorized ошибкой (500) → куки НЕ трогает, сессия жива', async () => {
    const { auth, mocks } = makeAuth();
    mocks.rotateRefreshToken.mockRejectedValue(new Error('DB down'));
    const controller = makeController(auth);
    const req = makeReq({ cookies: { [REFRESH_COOKIE]: 'ref-1' } });
    const { res, mocks: resMocks } = makeRes();

    await expect(controller.refresh(req, res)).rejects.toThrow('DB down');
    expect(resMocks.clearCookie).not.toHaveBeenCalled();
  });

  it('rotated:false (частая ротация подавлена) → access новый, Set-Cookie не выставляется', async () => {
    const { auth, mocks } = makeAuth();
    mocks.rotateRefreshToken.mockResolvedValue({
      accessToken: 'acc-fresh',
      refreshToken: 'ref-1', // тот же токен, что пришёл — кука не менялась
      expiresIn: 900,
      rotated: false,
    });
    const controller = makeController(auth);
    const req = makeReq({ cookies: { [REFRESH_COOKIE]: 'ref-1' } });
    const { res, mocks: resMocks } = makeRes();

    const result = await controller.refresh(req, res);

    expect(result).toEqual({ accessToken: 'acc-fresh', expiresIn: 900 });
    expect(resMocks.cookie).not.toHaveBeenCalled();
  });
});

describe('AuthController.logout', () => {
  it('без CSRF-заголовка → UnauthorizedException, ничего не отзывается', async () => {
    const { auth, mocks } = makeAuth();
    const controller = makeController(auth);
    const req = makeReq({ headers: {} });
    const { res } = makeRes();

    await expect(controller.logout('false', req, res)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(mocks.revokeSession).not.toHaveBeenCalled();
    expect(mocks.revokeAllSessions).not.toHaveBeenCalled();
  });

  it('без refresh-куки — ok:true, ничего не отзывается (нечего отзывать)', async () => {
    const { auth, mocks } = makeAuth();
    const controller = makeController(auth);
    const req = makeReq({ cookies: {} });
    const { res, mocks: resMocks } = makeRes();

    await expect(controller.logout('false', req, res)).resolves.toEqual({
      ok: true,
    });
    expect(mocks.revokeSession).not.toHaveBeenCalled();
    expect(resMocks.clearCookie).toHaveBeenCalledWith(REFRESH_COOKIE, {
      path: '/api/auth',
    });
    expect(resMocks.clearCookie).toHaveBeenCalledWith(CROSS_SITE_COOKIE, {
      path: '/api/auth',
    });
  });

  it('all=false — отзывает только текущую сессию (revokeSession), не revokeAllSessions', async () => {
    const { auth, mocks } = makeAuth();
    const controller = makeController(auth);
    const req = makeReq({ cookies: { [REFRESH_COOKIE]: 'ref-1' } });
    const { res } = makeRes();

    await controller.logout('false', req, res);

    expect(mocks.revokeSession).toHaveBeenCalledWith('ref-1');
    expect(mocks.revokeAllSessions).not.toHaveBeenCalled();
  });

  it('all=true — вращает токен, извлекает userId и отзывает все сессии', async () => {
    const { auth, mocks } = makeAuth();
    mocks.rotateRefreshToken.mockResolvedValue({
      accessToken: 'acc-1',
      refreshToken: 'ref-2',
      expiresIn: 900,
    });
    mocks.verifyAccessToken.mockReturnValue({ userId: 42n });
    const controller = makeController(auth);
    const req = makeReq({ cookies: { [REFRESH_COOKIE]: 'ref-1' } });
    const { res } = makeRes();

    await controller.logout('true', req, res);

    expect(mocks.revokeAllSessions).toHaveBeenCalledWith(42n);
    expect(mocks.revokeSession).not.toHaveBeenCalled();
  });

  it('all=true с уже невалидным refresh-токеном — UnauthorizedException проглатывается, logout всё равно завершается ok:true', async () => {
    const { auth, mocks } = makeAuth();
    mocks.rotateRefreshToken.mockRejectedValue(
      new UnauthorizedException('Refresh token invalid'),
    );
    const controller = makeController(auth);
    const req = makeReq({ cookies: { [REFRESH_COOKIE]: 'stale' } });
    const { res } = makeRes();

    await expect(controller.logout('true', req, res)).resolves.toEqual({
      ok: true,
    });
    expect(mocks.revokeAllSessions).not.toHaveBeenCalled();
  });

  it('all=true с реальной (не Unauthorized) ошибкой — тоже не роняет logout (логируется, не пробрасывается)', async () => {
    const { auth, mocks } = makeAuth();
    mocks.rotateRefreshToken.mockRejectedValue(new Error('DB down'));
    const controller = makeController(auth);
    const req = makeReq({ cookies: { [REFRESH_COOKIE]: 'ref-1' } });
    const { res } = makeRes();

    await expect(controller.logout('true', req, res)).resolves.toEqual({
      ok: true,
    });
  });
});

describe('AuthController.me', () => {
  it('собирает providers и totp-статус для webUser из запроса', async () => {
    const { auth, mocks } = makeAuth();
    mocks.getUserProviders.mockResolvedValue([
      { provider: 'google', email: 'a@b.ru', displayName: 'A' },
    ]);
    const controller = makeController(auth);
    const req = makeReq({ webUser: { userId: 42n } } as Partial<Request>);

    const result = await controller.me(req);

    expect(result.userId).toBe('42');
    expect(result.providers).toEqual([
      { provider: 'google', email: 'a@b.ru', displayName: 'A' },
    ]);
    expect(mocks.getUserProviders).toHaveBeenCalledWith(42n);
  });
});

describe('AuthController.issueLinkToken', () => {
  it('ставит httpOnly link_token куку и возвращает linkToken/expiresIn телом (обратная совместимость)', () => {
    const { auth, mocks } = makeAuth();
    const controller = makeController(auth);
    const req = makeReq({ webUser: { userId: 42n } } as Partial<Request>);
    const { res, mocks: resMocks } = makeRes();

    const result = controller.issueLinkToken(req, res);

    expect(mocks.buildLinkToken).toHaveBeenCalledWith(42n);
    expect(result).toEqual({ linkToken: 'link-token-1', expiresIn: 60 });
    expect(resMocks.cookie).toHaveBeenCalledWith(
      'link_token',
      'link-token-1',
      expect.objectContaining({ httpOnly: true, path: '/api/auth' }),
    );
  });
});
