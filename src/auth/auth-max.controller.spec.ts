// AuthMaxController — вход из мини-аппа MAX (тот же паттерн, что
// telegramWebApp в auth-account.controller.spec.ts). Инстанцируем напрямую
// с двойниками MaxProvider/AuthService/SecurityLogService.
import {
  BadRequestException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthMaxController } from './auth-max.controller';
import { AuthService, TokenPair } from './auth.service';
import { MaxProvider } from './providers/max.provider';
import { AnalyticsService } from '../analytics/analytics.service';
import { SecurityLogService } from './security-log.service';
import { CROSS_SITE_COOKIE, REFRESH_COOKIE } from './auth-http.util';
import { INITDATA_EXPIRED_CODE } from '../api/initdata-alert';
import { MaxNotConfiguredError } from './max-init-data';

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

function makeReq(
  headers: Record<string, string> = { 'x-requested-with': 'miniapp' },
): Request {
  return {
    headers,
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
  const analytics = { track: jest.fn().mockResolvedValue(undefined) };
  const controller = new AuthMaxController(
    maxProvider as unknown as MaxProvider,
    auth as unknown as AuthService,
    securityLog as unknown as SecurityLogService,
    analytics as unknown as AnalyticsService,
  );
  return { controller, auth, maxProvider, securityLog, analytics };
}

describe('AuthMaxController.maxWebApp', () => {
  // Login-CSRF (security#6): форма с чужого сайта несёт настоящую initData
  // атакующего. Подпись верна, значит отбить её может только проверка
  // заголовка — и до проверки подписи, и до выдачи куки.
  it('без CSRF-заголовка (форма с чужого сайта) → 401, ни подписи, ни куки', async () => {
    const { controller, auth, maxProvider, securityLog } = makeController();
    const res = makeRes();
    await expect(
      controller.maxWebApp(
        { initData: 'attacker-signed' },
        makeReq({ 'content-type': 'application/x-www-form-urlencoded' }),
        res,
      ),
    ).rejects.toThrow(UnauthorizedException);
    expect(securityLog.log).toHaveBeenCalledWith(
      'csrf_blocked',
      expect.objectContaining({ endpoint: 'max/webapp' }),
    );
    expect(maxProvider.verifyInitData).not.toHaveBeenCalled();
    expect(auth.issueTokens).not.toHaveBeenCalled();
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('JSON без x-requested-with допускается (форма JSON выставить не может)', async () => {
    const { controller, maxProvider } = makeController();
    maxProvider.verifyInitData.mockReturnValue({
      providerId: '777',
      displayName: 'E2E MAX',
    });
    const res = makeRes();
    await controller.maxWebApp(
      { initData: 'signed' },
      makeReq({ 'content-type': 'application/json' }),
      res,
    );
    expect(res.cookie).toHaveBeenCalledWith(
      REFRESH_COOKIE,
      FAKE_TOKENS.refreshToken,
      expect.objectContaining({ httpOnly: true }),
    );
  });

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

  // Аудит 2026-10: платформа запуска в мессенджере — строка в /stats.
  it('успешный обмен пишет messenger_launch с платформой MAX, userId = null', async () => {
    const { controller, maxProvider, analytics } = makeController();
    maxProvider.verifyInitData.mockReturnValue({ providerId: '777' });
    await controller.maxWebApp(
      { initData: 'signed-payload', platform: 'desktop' },
      makeReq(),
      makeRes(),
    );
    // Успех пишет только запуск — строки отказа обмена нет.
    expect(analytics.track).toHaveBeenCalledTimes(1);
    expect(analytics.track).toHaveBeenCalledWith(null, 'messenger_launch', {
      host: 'max',
      platform: 'desktop',
    });
  });

  it('просроченная подпись → 401 с кодом initdata_expired, без алерта', async () => {
    const { controller, maxProvider, securityLog, auth, analytics } =
      makeController();
    maxProvider.verifyInitData.mockImplementation(() => {
      throw new Error('init data expired');
    });
    const req = makeReq();
    (req as unknown as { ip: string }).ip = '203.0.113.41';

    await expect(
      controller.maxWebApp(
        { initData: 'stale', platform: 'ios' },
        req,
        makeRes(),
      ),
    ).rejects.toMatchObject({
      response: { code: INITDATA_EXPIRED_CODE },
      status: 401,
    });
    expect(securityLog.log).not.toHaveBeenCalled();
    expect(auth.findOrCreateUserByProvider).not.toHaveBeenCalled();
    // Находка 2026-11-08: отказ обмена виден в /stats — с причиной.
    expect(analytics.track).toHaveBeenCalledWith(
      null,
      'messenger_launch_failed',
      { host: 'max', platform: 'ios', reason: 'expired' },
    );
  });

  it('поддельная подпись → 401 + securityLog.log("suspicious_initdata")', async () => {
    const { controller, maxProvider, securityLog, analytics } =
      makeController();
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
    // Запуска не было — засчитан только отказ, причина «подделка»; ни IP,
    // ни текста ошибки в meta нет.
    expect(analytics.track).toHaveBeenCalledTimes(1);
    expect(analytics.track).toHaveBeenCalledWith(
      null,
      'messenger_launch_failed',
      { host: 'max', platform: 'other', reason: 'suspicious' },
    );
  });

  // Пока MAX_BOT_TOKEN не проставлен, КАЖДАЯ попытка входа из мессенджера
  // приходила бы админу как «подделка подписи». Это наша несобранная
  // конфигурация: отвечаем 503 и молчим в аудит-лог.
  it('нет MAX_BOT_TOKEN → 503, и админ НЕ получает алерт о подделке', async () => {
    const { controller, maxProvider, securityLog, auth, analytics } =
      makeController();
    maxProvider.verifyInitData.mockImplementation(() => {
      throw new MaxNotConfiguredError();
    });
    const req = makeReq();
    (req as unknown as { ip: string }).ip = '203.0.113.42';

    await expect(
      controller.maxWebApp({ initData: 'что угодно' }, req, makeRes()),
    ).rejects.toThrow(ServiceUnavailableException);
    expect(securityLog.log).not.toHaveBeenCalled();
    expect(auth.issueTokens).not.toHaveBeenCalled();
    // Это не клиент не смог войти, а мы не настроили вход: в /stats отказа нет.
    expect(analytics.track).not.toHaveBeenCalled();
  });
});
