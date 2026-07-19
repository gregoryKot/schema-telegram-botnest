// Auth2faController был на 0% покрытия. Инстанцируем напрямую (без Nest
// TestingModule) с типизированными двойниками зависимостей — паттерн
// auth-flow.service.spec.ts (Pick<Service, 'method'> & { method: jest.Mock },
// makeReq/makeRes с `as unknown as Request/Response`). Каждый мутирующий
// хендлер проверяет CSRF-инвариант (requireCsrf вызывается ДО сервиса —
// правило "Обработка ошибок" в CLAUDE.md), плюс happy-path и главную ошибку.
import { UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { Auth2faController } from './auth-2fa.controller';
import { AuthService, TokenPair } from './auth.service';
import { SecurityLogService } from './security-log.service';
import { TotpService } from './totp.service';
import { EmailService } from './email.service';
import { REFRESH_COOKIE } from './auth-http.util';
import { TwoFaChallengeDto, TwoFaCodeDto } from './dto/twofa.dto';

const WEBAPP_URL = 'https://schemehappens.ru';

const FAKE_TOKENS: TokenPair = {
  accessToken: 'access-abc',
  refreshToken: 'refresh-abc',
  expiresIn: 900,
};

type AuthMock = Pick<
  AuthService,
  'getUserProviders' | 'issueTokens' | 'verifyTotpChallengeToken'
> & {
  getUserProviders: jest.Mock;
  issueTokens: jest.Mock;
  verifyTotpChallengeToken: jest.Mock;
};

type TotpMock = Pick<
  TotpService,
  | 'startSetup'
  | 'confirmSetup'
  | 'disable'
  | 'regenerateRecoveryCodes'
  | 'verifyCode'
> & {
  startSetup: jest.Mock;
  confirmSetup: jest.Mock;
  disable: jest.Mock;
  regenerateRecoveryCodes: jest.Mock;
  verifyCode: jest.Mock;
};

type EmailMock = Pick<
  EmailService,
  'sendVerificationLink' | 'consumeToken' | 'sendRecoveryLink'
> & {
  sendVerificationLink: jest.Mock;
  consumeToken: jest.Mock;
  sendRecoveryLink: jest.Mock;
};

type SecurityLogMock = Pick<SecurityLogService, 'log'> & { log: jest.Mock };

function makeAuth(): AuthMock {
  return {
    getUserProviders: jest.fn().mockResolvedValue([]),
    issueTokens: jest.fn().mockResolvedValue(FAKE_TOKENS),
    verifyTotpChallengeToken: jest
      .fn()
      .mockReturnValue({ userId: 7n, ip: null, ua: '' }),
  };
}

function makeTotp(): TotpMock {
  return {
    startSetup: jest.fn().mockResolvedValue({
      otpauthUrl: 'otpauth://totp/x',
      qrDataUrl: 'data:image/png;base64,xx',
    }),
    confirmSetup: jest
      .fn()
      .mockResolvedValue({ recoveryCodes: ['a1b2c3d4e5'] }),
    disable: jest.fn().mockResolvedValue(undefined),
    regenerateRecoveryCodes: jest
      .fn()
      .mockResolvedValue({ recoveryCodes: ['f6g7h8i9j0'] }),
    verifyCode: jest.fn().mockResolvedValue(true),
  };
}

function makeEmail(): EmailMock {
  return {
    sendVerificationLink: jest.fn().mockResolvedValue({ ok: true }),
    consumeToken: jest.fn().mockResolvedValue({ userId: 1n, email: 'a@b.ru' }),
    sendRecoveryLink: jest.fn().mockResolvedValue({ ok: true }),
  };
}

function makeConfig(): ConfigService {
  return {
    getOrThrow: jest.fn((key: string) => {
      if (key === 'WEBAPP_URL') return WEBAPP_URL;
      throw new Error(`unexpected config key ${key}`);
    }),
  } as unknown as ConfigService;
}

function makeSecurityLog(): SecurityLogMock {
  return { log: jest.fn() };
}

function makeReq(
  opts: {
    csrf?: boolean;
    webUser?: { userId: bigint };
  } = {},
): Request {
  const headers: Record<string, string> = {};
  if (opts.csrf !== false) headers['x-requested-with'] = 'XMLHttpRequest';
  return {
    headers,
    webUser: opts.webUser,
    ip: '198.51.100.1',
    cookies: {},
  } as unknown as Request;
}

function makeRes(): Response & { cookie: jest.Mock; redirect: jest.Mock } {
  return {
    cookie: jest.fn(),
    redirect: jest.fn(),
  } as unknown as Response & { cookie: jest.Mock; redirect: jest.Mock };
}

function makeController() {
  const auth = makeAuth();
  const config = makeConfig();
  const securityLog = makeSecurityLog();
  const totp = makeTotp();
  const emailSvc = makeEmail();
  const controller = new Auth2faController(
    auth as unknown as AuthService,
    config,
    securityLog as unknown as SecurityLogService,
    totp as unknown as TotpService,
    emailSvc as unknown as EmailService,
  );
  return { controller, auth, config, securityLog, totp, emailSvc };
}

const CODE_DTO: TwoFaCodeDto = { code: '123456' };

describe('Auth2faController.totpSetup', () => {
  it('без CSRF-заголовка → UnauthorizedException, сервис не вызывается', async () => {
    const { controller, totp } = makeController();
    await expect(
      controller.totpSetup(makeReq({ csrf: false, webUser: { userId: 1n } })),
    ).rejects.toThrow(UnauthorizedException);
    expect(totp.startSetup).not.toHaveBeenCalled();
  });

  it('валидный запрос → метка из email первого провайдера', async () => {
    const { controller, auth, totp } = makeController();
    auth.getUserProviders.mockResolvedValue([
      { provider: 'google', email: 'greg@example.com', displayName: 'Грег' },
    ]);
    const res = await controller.totpSetup(
      makeReq({ webUser: { userId: 5n } }),
    );
    expect(totp.startSetup).toHaveBeenCalledWith(5n, 'greg@example.com');
    expect(res).toEqual({
      otpauthUrl: 'otpauth://totp/x',
      qrDataUrl: 'data:image/png;base64,xx',
    });
  });

  it('нет email/displayName у провайдеров → метка "user-<id>"', async () => {
    const { controller, auth, totp } = makeController();
    auth.getUserProviders.mockResolvedValue([]);
    await controller.totpSetup(makeReq({ webUser: { userId: 9n } }));
    expect(totp.startSetup).toHaveBeenCalledWith(9n, 'user-9');
  });
});

describe('Auth2faController.totpEnable', () => {
  it('без CSRF-заголовка → UnauthorizedException, confirmSetup не вызывается', async () => {
    const { controller, totp } = makeController();
    await expect(
      controller.totpEnable(
        makeReq({ csrf: false, webUser: { userId: 1n } }),
        CODE_DTO,
      ),
    ).rejects.toThrow(UnauthorizedException);
    expect(totp.confirmSetup).not.toHaveBeenCalled();
  });

  it('валидный запрос → confirmSetup + аудит role_changed(2fa_enabled)', async () => {
    const { controller, totp, securityLog } = makeController();
    const res = await controller.totpEnable(
      makeReq({ webUser: { userId: 3n } }),
      CODE_DTO,
    );
    expect(totp.confirmSetup).toHaveBeenCalledWith(3n, '123456');
    expect(securityLog.log).toHaveBeenCalledWith('role_changed', {
      userId: 3n,
      event: '2fa_enabled',
    });
    expect(res).toEqual({ recoveryCodes: ['a1b2c3d4e5'] });
  });
});

describe('Auth2faController.totpDisable', () => {
  it('без CSRF-заголовка → UnauthorizedException, disable не вызывается', async () => {
    const { controller, totp } = makeController();
    await expect(
      controller.totpDisable(
        makeReq({ csrf: false, webUser: { userId: 1n } }),
        CODE_DTO,
      ),
    ).rejects.toThrow(UnauthorizedException);
    expect(totp.disable).not.toHaveBeenCalled();
  });

  it('валидный запрос → disable + аудит role_changed(2fa_disabled)', async () => {
    const { controller, totp, securityLog } = makeController();
    const res = await controller.totpDisable(
      makeReq({ webUser: { userId: 3n } }),
      CODE_DTO,
    );
    expect(totp.disable).toHaveBeenCalledWith(3n, '123456');
    expect(securityLog.log).toHaveBeenCalledWith('role_changed', {
      userId: 3n,
      event: '2fa_disabled',
    });
    expect(res).toEqual({ ok: true });
  });
});

describe('Auth2faController.totpRegenerateRecovery', () => {
  it('без CSRF-заголовка → UnauthorizedException, регенерация не вызывается', async () => {
    const { controller, totp } = makeController();
    await expect(
      controller.totpRegenerateRecovery(
        makeReq({ csrf: false, webUser: { userId: 1n } }),
        CODE_DTO,
      ),
    ).rejects.toThrow(UnauthorizedException);
    expect(totp.regenerateRecoveryCodes).not.toHaveBeenCalled();
  });

  it('валидный запрос → делегирует в totp.regenerateRecoveryCodes', async () => {
    const { controller, totp } = makeController();
    const res = await controller.totpRegenerateRecovery(
      makeReq({ webUser: { userId: 4n } }),
      CODE_DTO,
    );
    expect(totp.regenerateRecoveryCodes).toHaveBeenCalledWith(4n, '123456');
    expect(res).toEqual({ recoveryCodes: ['f6g7h8i9j0'] });
  });
});

describe('Auth2faController.recoveryEmailStart', () => {
  it('без CSRF-заголовка → UnauthorizedException, письмо не отправляется', async () => {
    const { controller, emailSvc } = makeController();
    await expect(
      controller.recoveryEmailStart(
        makeReq({ csrf: false, webUser: { userId: 1n } }),
        'a@b.ru',
      ),
    ).rejects.toThrow(UnauthorizedException);
    expect(emailSvc.sendVerificationLink).not.toHaveBeenCalled();
  });

  it('валидный запрос → делегирует в emailSvc.sendVerificationLink', async () => {
    const { controller, emailSvc } = makeController();
    const res = await controller.recoveryEmailStart(
      makeReq({ webUser: { userId: 6n } }),
      'a@b.ru',
    );
    expect(emailSvc.sendVerificationLink).toHaveBeenCalledWith(6n, 'a@b.ru');
    expect(res).toEqual({ ok: true });
  });
});

describe('Auth2faController.recoveryEmailVerify', () => {
  it('успешный токен → редирект на /account?verified=1', async () => {
    const { controller, emailSvc } = makeController();
    const res = makeRes();
    await controller.recoveryEmailVerify('tok-1', res);
    expect(emailSvc.consumeToken).toHaveBeenCalledWith('tok-1', 'verify_email');
    expect(res.redirect).toHaveBeenCalledWith(
      `${WEBAPP_URL}/account?verified=1`,
    );
  });

  it('невалидный/просроченный токен → редирект на /account?verified=0, исключение не пробрасывается', async () => {
    const { controller, emailSvc } = makeController();
    emailSvc.consumeToken.mockRejectedValue(new Error('expired'));
    const res = makeRes();
    await expect(
      controller.recoveryEmailVerify('bad-tok', res),
    ).resolves.toBeUndefined();
    expect(res.redirect).toHaveBeenCalledWith(
      `${WEBAPP_URL}/account?verified=0`,
    );
  });
});

describe('Auth2faController.recoveryRequest', () => {
  it('публичный эндпоинт (без CSRF) → делегирует в emailSvc.sendRecoveryLink', async () => {
    const { controller, emailSvc } = makeController();
    const res = await controller.recoveryRequest('x@y.ru');
    expect(emailSvc.sendRecoveryLink).toHaveBeenCalledWith('x@y.ru');
    expect(res).toEqual({ ok: true });
  });
});

describe('Auth2faController.recoveryConfirm', () => {
  it('без CSRF-заголовка → UnauthorizedException, токен не потребляется', async () => {
    const { controller, emailSvc } = makeController();
    await expect(
      controller.recoveryConfirm(makeReq({ csrf: false }), makeRes(), 'tok-1'),
    ).rejects.toThrow(UnauthorizedException);
    expect(emailSvc.consumeToken).not.toHaveBeenCalled();
  });

  it('валидный запрос → сессия выдана, cookie httpOnly/strict, аудит recovery_login', async () => {
    const { controller, emailSvc, auth, securityLog } = makeController();
    emailSvc.consumeToken.mockResolvedValue({ userId: 8n, email: 'x@y.ru' });
    const req = makeReq();
    const res = makeRes();
    const result = await controller.recoveryConfirm(req, res, 'tok-1');
    expect(emailSvc.consumeToken).toHaveBeenCalledWith('tok-1', 'recovery');
    expect(auth.issueTokens).toHaveBeenCalledWith(
      8n,
      '198.51.100.1',
      undefined,
    );
    expect(res.cookie).toHaveBeenCalledWith(
      REFRESH_COOKIE,
      FAKE_TOKENS.refreshToken,
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        path: '/api/auth',
      }),
    );
    expect(securityLog.log).toHaveBeenCalledWith('role_changed', {
      userId: 8n,
      event: 'recovery_login',
      ip: '198.51.100.1',
    });
    expect(result).toEqual({
      accessToken: FAKE_TOKENS.accessToken,
      expiresIn: FAKE_TOKENS.expiresIn,
    });
  });
});

describe('Auth2faController.totpChallenge', () => {
  const CHALLENGE_DTO: TwoFaChallengeDto = {
    code: '654321',
    challengeToken: 'challenge-tok',
  };

  it('без CSRF-заголовка → UnauthorizedException, токен не проверяется', async () => {
    const { controller, auth } = makeController();
    await expect(
      controller.totpChallenge(
        makeReq({ csrf: false }),
        makeRes(),
        CHALLENGE_DTO,
      ),
    ).rejects.toThrow(UnauthorizedException);
    expect(auth.verifyTotpChallengeToken).not.toHaveBeenCalled();
  });

  it('верный код → сессия выдана, cookie httpOnly/strict', async () => {
    const { controller, auth, totp } = makeController();
    auth.verifyTotpChallengeToken.mockReturnValue({
      userId: 7n,
      ip: null,
      ua: '',
    });
    totp.verifyCode.mockResolvedValue(true);
    const req = makeReq();
    const res = makeRes();
    const result = await controller.totpChallenge(req, res, CHALLENGE_DTO);
    expect(totp.verifyCode).toHaveBeenCalledWith(7n, '654321');
    expect(auth.issueTokens).toHaveBeenCalledWith(
      7n,
      '198.51.100.1',
      undefined,
    );
    expect(res.cookie).toHaveBeenCalledWith(
      REFRESH_COOKIE,
      FAKE_TOKENS.refreshToken,
      expect.objectContaining({ httpOnly: true, sameSite: 'strict' }),
    );
    expect(result).toEqual({
      accessToken: FAKE_TOKENS.accessToken,
      expiresIn: FAKE_TOKENS.expiresIn,
    });
  });

  it('неверный код → UnauthorizedException, tokens не выдаются', async () => {
    const { controller, auth, totp } = makeController();
    totp.verifyCode.mockResolvedValue(false);
    await expect(
      controller.totpChallenge(makeReq(), makeRes(), CHALLENGE_DTO),
    ).rejects.toThrow(UnauthorizedException);
    expect(auth.issueTokens).not.toHaveBeenCalled();
  });
});
