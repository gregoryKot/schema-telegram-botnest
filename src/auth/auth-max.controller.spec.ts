// AuthMaxController — вход из мини-аппа MAX (тот же паттерн, что
// telegramWebApp в auth-account.controller.spec.ts). Инстанцируем напрямую
// с двойниками MaxProvider/AuthService/SecurityLogService.
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthMaxController } from './auth-max.controller';
import { AuthService, TokenPair } from './auth.service';
import { MaxProvider } from './providers/max.provider';
import { SecurityLogService } from './security-log.service';
import { CROSS_SITE_COOKIE, REFRESH_COOKIE } from './auth-http.util';
import { INITDATA_EXPIRED_CODE } from '../api/initdata-alert';

const FAKE_TOKENS: TokenPair = {
  accessToken: 'access-max-1',
  refreshToken: 'refresh-max-1',
  expiresIn: 900,
};

type AuthMock = Pick<
  AuthService,
  'findOrCreateUserByProvider' | 'issueTokens'
> & {
  findOrCreateUserByProvider: jest.Mock;
  issueTokens: jest.Mock;
};

function makeAuth(): AuthMock {
  return {
    findOrCreateUserByProvider: jest.fn().mockResolvedValue(123n),
    issueTokens: jest.fn().mockResolvedValue(FAKE_TOKENS),
  };
}

function makeMaxProvider(): { verifyInitData: jest.Mock } {
  return { verifyInitData: jest.fn() };
}

function makeSecurityLog(): { log: jest.Mock } {
  return { log: jest.fn() };
}

function makeReq(): Request {
  return {
    headers: {},
    ip: '198.51.100.1',
  } as unknown as Request;
}

function makeRes(): Response & { cookie: jest.Mock; clearCookie: jest.Mock } {
  return {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  } as unknown as Response & { cookie: jest.Mock; clearCookie: jest.Mock };
}

function makeController() {
  const auth = makeAuth();
  const maxProvider = makeMaxProvider();
  const securityLog = makeSecurityLog();
  const controller = new AuthMaxController(
    maxProvider as unknown as MaxProvider,
    auth as unknown as AuthService,
    securityLog as unknown as SecurityLogService,
  );
  return { controller, auth, maxProvider, securityLog };
}

describe('AuthMaxController.maxWebApp', () => {
  it('пустой initData → BadRequestException, подпись не проверяется', async () => {
    const { controller, maxProvider } = makeController();
    await expect(
      controller.maxWebApp({ initData: '' }, makeReq(), makeRes()),
    ).rejects.toThrow(BadRequestException);
    expect(maxProvider.verifyInitData).not.toHaveBeenCalled();
  });

  it('валидная подпись → находит/создаёт юзера через провайдер max, выдаёт токены, ставит cookie', async () => {
    const { controller, auth, maxProvider } = makeController();
    maxProvider.verifyInitData.mockReturnValue({
      providerId: '777',
      displayName: 'E2E MAX',
    });
    const req = makeReq();
    const res = makeRes();

    const result = await controller.maxWebApp(
      { initData: 'signed-payload' },
      req,
      res,
    );

    expect(maxProvider.verifyInitData).toHaveBeenCalledWith('signed-payload');
    expect(auth.findOrCreateUserByProvider).toHaveBeenCalledWith(
      'max',
      '777',
      'E2E MAX',
    );
    expect(auth.issueTokens).toHaveBeenCalledWith(
      123n,
      '198.51.100.1',
      undefined,
    );
    // sameSite:none осознанно: MAX открывает мини-апп в чужом iframe, откуда
    // strict-куку браузер не отправит и сессия не продлится. Рядом едет метка,
    // чтобы ротация в /api/auth/refresh не понизила куку обратно до strict.
    expect(res.cookie).toHaveBeenCalledWith(
      REFRESH_COOKIE,
      FAKE_TOKENS.refreshToken,
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: 'none',
      }),
    );
    expect(res.cookie).toHaveBeenCalledWith(
      CROSS_SITE_COOKIE,
      '1',
      expect.objectContaining({ sameSite: 'none' }),
    );
    expect(result).toEqual({
      accessToken: FAKE_TOKENS.accessToken,
      expiresIn: FAKE_TOKENS.expiresIn,
    });
  });

  it('просроченная подпись → 401 с кодом initdata_expired, без алерта', async () => {
    const { controller, maxProvider, securityLog, auth } = makeController();
    maxProvider.verifyInitData.mockImplementation(() => {
      throw new Error('init data expired');
    });

    await expect(
      controller.maxWebApp({ initData: 'stale' }, makeReq(), makeRes()),
    ).rejects.toMatchObject({
      response: { code: INITDATA_EXPIRED_CODE },
      status: 401,
    });
    expect(securityLog.log).not.toHaveBeenCalled();
    expect(auth.findOrCreateUserByProvider).not.toHaveBeenCalled();
  });

  it('поддельная подпись → 401 + securityLog.log("suspicious_initdata")', async () => {
    const { controller, maxProvider, securityLog } = makeController();
    maxProvider.verifyInitData.mockImplementation(() => {
      throw new Error('Invalid MAX initData signature');
    });
    const req = makeReq();
    (req as unknown as { ip: string }).ip = '6.6.6.6';

    await expect(
      controller.maxWebApp({ initData: 'forged' }, req, makeRes()),
    ).rejects.toThrow(UnauthorizedException);
    expect(securityLog.log).toHaveBeenCalledWith(
      'suspicious_initdata',
      expect.objectContaining({ ip: '6.6.6.6' }),
    );
  });
});
