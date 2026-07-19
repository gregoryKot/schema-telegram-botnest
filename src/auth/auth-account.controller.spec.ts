// AuthAccountController был на 0% покрытия. Инстанцируем напрямую (без Nest
// TestingModule) с типизированными двойниками — паттерн auth-flow.service.spec.ts
// (Pick<Service, 'method'> & { method: jest.Mock }, makeReq/makeRes через
// `as unknown as Request/Response`). Каждый мутирующий хендлер с requireCsrf
// проверяет: CSRF-заголовок отсутствует → UnauthorizedException ДО обращения
// к сервису (правило "Обработка ошибок" CLAUDE.md); happy-path + основная
// ошибка/guard-ветка — для остальных хендлеров.
//
// AuthProviderRegistry (реальный, импортируется контроллером через DI-тип
// конструктора → попадает в emitDecoratorMetadata) тянет GoogleProvider, а тот —
// пакет 'jose' (чистый ESM, ts-jest его не парсит без спец-конфига). Реальный
// GoogleProvider тут не нужен — registry в тестах мокается двойником целиком —
// поэтому подменяем модуль тем же способом, что и auth-flow.service.spec.ts.
jest.mock('./providers/google.provider', () => ({ GoogleProvider: class {} }));

import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthAccountController } from './auth-account.controller';
import { AuthService, TokenPair } from './auth.service';
import { AuthProviderRegistry } from './providers/registry';
import { AuthProviderHandler, ProviderIdentity } from './providers/types';
import { MergeService } from './merge.service';
import { SecurityLogService } from './security-log.service';
import { REFRESH_COOKIE } from './auth-http.util';

const WEBAPP_URL = 'https://schemehappens.ru';

const FAKE_TOKENS: TokenPair = {
  accessToken: 'access-abc',
  refreshToken: 'refresh-abc',
  expiresIn: 900,
};

type AuthMock = Pick<
  AuthService,
  | 'requestEmailLogin'
  | 'consumeEmailToken'
  | 'linkEmailToAccount'
  | 'verifyTelegramWebAppData'
  | 'findOrCreateUserByProvider'
  | 'issueTokens'
  | 'verifyMergeToken'
  | 'linkProviderToUser'
  | 'buildMergeToken'
  | 'unlinkProvider'
> & {
  requestEmailLogin: jest.Mock;
  consumeEmailToken: jest.Mock;
  linkEmailToAccount: jest.Mock;
  verifyTelegramWebAppData: jest.Mock;
  findOrCreateUserByProvider: jest.Mock;
  issueTokens: jest.Mock;
  verifyMergeToken: jest.Mock;
  linkProviderToUser: jest.Mock;
  buildMergeToken: jest.Mock;
  unlinkProvider: jest.Mock;
};

type MergeMock = Pick<MergeService, 'merge' | 'summarize'> & {
  merge: jest.Mock;
  summarize: jest.Mock;
};

type SecurityLogMock = Pick<SecurityLogService, 'log'> & { log: jest.Mock };

type ProvidersMock = { get: jest.Mock; list: jest.Mock };

function makeAuth(): AuthMock {
  return {
    requestEmailLogin: jest.fn().mockResolvedValue({ ok: true }),
    consumeEmailToken: jest.fn().mockResolvedValue({
      tokens: FAKE_TOKENS,
      purpose: 'login',
      userId: 1n,
    }),
    linkEmailToAccount: jest.fn().mockResolvedValue({ ok: true }),
    verifyTelegramWebAppData: jest
      .fn()
      .mockReturnValue({ id: 123, firstName: 'Bob' }),
    findOrCreateUserByProvider: jest.fn().mockResolvedValue(123n),
    issueTokens: jest.fn().mockResolvedValue(FAKE_TOKENS),
    verifyMergeToken: jest.fn().mockReturnValue({
      target: 1n,
      source: 2n,
      provider: 'google',
      providerId: 'g-1',
    }),
    linkProviderToUser: jest.fn().mockResolvedValue({ ok: true }),
    buildMergeToken: jest.fn().mockReturnValue('merge-tok'),
    unlinkProvider: jest.fn().mockResolvedValue(undefined),
  };
}

function makeMerge(): MergeMock {
  return {
    merge: jest.fn().mockResolvedValue(undefined),
    summarize: jest.fn().mockResolvedValue({ Note: 3, Rating: 12 }),
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

function makeProviders(
  handler?: Partial<AuthProviderHandler>,
  list: AuthProviderHandler[] = [],
): ProvidersMock {
  return {
    get: jest.fn().mockReturnValue(handler),
    list: jest.fn().mockReturnValue(list),
  };
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

function makeController(opts: { providers?: ProvidersMock } = {}) {
  const auth = makeAuth();
  const config = makeConfig();
  const providers = opts.providers ?? makeProviders();
  const merge = makeMerge();
  const securityLog = makeSecurityLog();
  const controller = new AuthAccountController(
    auth as unknown as AuthService,
    config,
    providers as unknown as AuthProviderRegistry,
    merge as unknown as MergeService,
    securityLog as unknown as SecurityLogService,
  );
  return { controller, auth, config, providers, merge, securityLog };
}

describe('AuthAccountController.emailLoginLink', () => {
  it('без CSRF-заголовка → UnauthorizedException, письмо не отправляется', async () => {
    const { controller, auth } = makeController();
    await expect(
      controller.emailLoginLink('a@b.ru', makeReq({ csrf: false })),
    ).rejects.toThrow(UnauthorizedException);
    expect(auth.requestEmailLogin).not.toHaveBeenCalled();
  });

  it('валидный запрос → делегирует в auth.requestEmailLogin', async () => {
    const { controller, auth } = makeController();
    const res = await controller.emailLoginLink('a@b.ru', makeReq());
    expect(auth.requestEmailLogin).toHaveBeenCalledWith('a@b.ru');
    expect(res).toEqual({ ok: true });
  });
});

describe('AuthAccountController.emailLoginCallback', () => {
  it('purpose="login" → cookie выставлена, редирект на /auth/callback с access_token', async () => {
    const { controller, auth } = makeController();
    auth.consumeEmailToken.mockResolvedValue({
      tokens: FAKE_TOKENS,
      purpose: 'login',
      userId: 1n,
    });
    const res = makeRes();
    await controller.emailLoginCallback('tok-1', makeReq(), res);
    expect(res.cookie).toHaveBeenCalledWith(
      REFRESH_COOKIE,
      FAKE_TOKENS.refreshToken,
      expect.objectContaining({ httpOnly: true, sameSite: 'strict' }),
    );
    expect(res.redirect).toHaveBeenCalledWith(
      `${WEBAPP_URL}/auth/callback#access_token=${FAKE_TOKENS.accessToken}&expires_in=${FAKE_TOKENS.expiresIn}`,
    );
  });

  it('purpose="link_email_auth" → редирект на /account?linked=email', async () => {
    const { controller, auth } = makeController();
    auth.consumeEmailToken.mockResolvedValue({
      tokens: FAKE_TOKENS,
      purpose: 'link_email_auth',
      userId: 1n,
    });
    const res = makeRes();
    await controller.emailLoginCallback('tok-1', makeReq(), res);
    expect(res.redirect).toHaveBeenCalledWith(
      `${WEBAPP_URL}/account?linked=email`,
    );
  });

  it('просроченный/невалидный токен → редирект на /auth/error, без cookie', async () => {
    const { controller, auth } = makeController();
    auth.consumeEmailToken.mockRejectedValue(new Error('expired'));
    const res = makeRes();
    await expect(
      controller.emailLoginCallback('bad-tok', makeReq(), res),
    ).resolves.toBeUndefined();
    expect(res.cookie).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith(
      `${WEBAPP_URL}/auth/error?reason=email_link_expired`,
    );
  });
});

describe('AuthAccountController.emailLinkToAccount', () => {
  it('без CSRF-заголовка → UnauthorizedException, линковка не выполняется', async () => {
    const { controller, auth } = makeController();
    await expect(
      controller.emailLinkToAccount(
        'a@b.ru',
        makeReq({ csrf: false, webUser: { userId: 1n } }),
      ),
    ).rejects.toThrow(UnauthorizedException);
    expect(auth.linkEmailToAccount).not.toHaveBeenCalled();
  });

  it('валидный запрос → делегирует в auth.linkEmailToAccount', async () => {
    const { controller, auth } = makeController();
    const res = await controller.emailLinkToAccount(
      'a@b.ru',
      makeReq({ webUser: { userId: 9n } }),
    );
    expect(auth.linkEmailToAccount).toHaveBeenCalledWith(9n, 'a@b.ru');
    expect(res).toEqual({ ok: true });
  });
});

describe('AuthAccountController.telegramWebApp', () => {
  it('без initData → BadRequestException, подпись не проверяется', async () => {
    const { controller, auth } = makeController();
    await expect(
      controller.telegramWebApp('', makeReq(), makeRes()),
    ).rejects.toThrow(BadRequestException);
    expect(auth.verifyTelegramWebAppData).not.toHaveBeenCalled();
  });

  it('валидный initData → находит/создаёт юзера, выдаёт токены, ставит cookie', async () => {
    const { controller, auth } = makeController();
    const req = makeReq();
    const res = makeRes();
    const result = await controller.telegramWebApp('init-data', req, res);
    expect(auth.verifyTelegramWebAppData).toHaveBeenCalledWith('init-data');
    expect(auth.findOrCreateUserByProvider).toHaveBeenCalledWith(
      'telegram',
      '123',
      'Bob',
    );
    expect(auth.issueTokens).toHaveBeenCalledWith(
      123n,
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
});

describe('AuthAccountController.confirmMerge', () => {
  it('без CSRF-заголовка → UnauthorizedException, токен не проверяется', async () => {
    const { controller, auth } = makeController();
    await expect(
      controller.confirmMerge('tok-1', makeReq({ csrf: false }), makeRes()),
    ).rejects.toThrow(UnauthorizedException);
    expect(auth.verifyMergeToken).not.toHaveBeenCalled();
  });

  it('пустой токен → BadRequestException, verifyMergeToken не вызывается', async () => {
    const { controller, auth } = makeController();
    await expect(
      controller.confirmMerge('', makeReq(), makeRes()),
    ).rejects.toThrow(BadRequestException);
    expect(auth.verifyMergeToken).not.toHaveBeenCalled();
  });

  it('текущая сессия принадлежит другому userId → UnauthorizedException, merge не выполняется', async () => {
    const { controller, merge } = makeController();
    const req = makeReq({ webUser: { userId: 999n } }); // target из токена = 1n
    await expect(
      controller.confirmMerge('tok-1', req, makeRes()),
    ).rejects.toThrow(UnauthorizedException);
    expect(merge.merge).not.toHaveBeenCalled();
  });

  it('merge.merge падает → BadRequestException с дружелюбным текстом, линковка провайдера не выполняется', async () => {
    const { controller, auth, merge } = makeController();
    merge.merge.mockRejectedValue(new Error('db down'));
    await expect(
      controller.confirmMerge('tok-1', makeReq(), makeRes()),
    ).rejects.toThrow(BadRequestException);
    expect(auth.linkProviderToUser).not.toHaveBeenCalled();
  });

  it('linkProviderToUser возвращает ok:false → BadRequestException "Provider link failed"', async () => {
    const { controller, auth } = makeController();
    auth.linkProviderToUser.mockResolvedValue({
      ok: false,
      conflictUserId: '2',
    });
    await expect(
      controller.confirmMerge('tok-1', makeReq(), makeRes()),
    ).rejects.toThrow(BadRequestException);
  });

  it('валидный merge → данные перенесены, токены выданы, cookie httpOnly/strict, аудит merge_confirmed', async () => {
    const { controller, auth, merge, securityLog } = makeController();
    const req = makeReq();
    const res = makeRes();
    const result = await controller.confirmMerge('tok-1', req, res);
    expect(merge.merge).toHaveBeenCalledWith(2n, 1n);
    expect(auth.linkProviderToUser).toHaveBeenCalledWith(1n, 'google', 'g-1');
    expect(auth.issueTokens).toHaveBeenCalledWith(
      1n,
      '198.51.100.1',
      undefined,
    );
    expect(res.cookie).toHaveBeenCalledWith(
      REFRESH_COOKIE,
      FAKE_TOKENS.refreshToken,
      expect.objectContaining({ httpOnly: true, sameSite: 'strict' }),
    );
    expect(securityLog.log).toHaveBeenCalledWith('merge_confirmed', {
      target: 1n,
      source: 2n,
      provider: 'google',
      ip: '198.51.100.1',
    });
    expect(result).toEqual({
      accessToken: FAKE_TOKENS.accessToken,
      expiresIn: FAKE_TOKENS.expiresIn,
    });
  });
});

describe('AuthAccountController.linkProvider', () => {
  it('провайдер без verifyClientData → BadRequestException, линковка не выполняется', async () => {
    const providers = makeProviders({ id: 'google', displayName: 'Google' });
    const { controller, auth } = makeController({ providers });
    await expect(
      controller.linkProvider(
        'google',
        {},
        makeReq({ webUser: { userId: 1n } }),
      ),
    ).rejects.toThrow(BadRequestException);
    expect(auth.linkProviderToUser).not.toHaveBeenCalled();
  });

  it('успешная линковка (без конфликта) → { ok: true }', async () => {
    const identity: ProviderIdentity = {
      providerId: 'tg-1',
      displayName: 'Грег',
    };
    const verifyClientData = jest.fn().mockReturnValue(identity);
    const providers = makeProviders({
      id: 'telegram',
      displayName: 'Telegram',
      verifyClientData,
    });
    const { controller, auth } = makeController({ providers });
    const body = { hash: 'x' };
    const res = await controller.linkProvider(
      'telegram',
      body,
      makeReq({ webUser: { userId: 5n } }),
    );
    expect(verifyClientData).toHaveBeenCalledWith(body);
    expect(auth.linkProviderToUser).toHaveBeenCalledWith(
      5n,
      'telegram',
      'tg-1',
      'Грег',
      undefined,
    );
    expect(res).toEqual({ ok: true });
  });

  it('конфликт providerId с другим userId → возвращает mergeToken + summary', async () => {
    const identity: ProviderIdentity = { providerId: 'tg-1' };
    const verifyClientData = jest.fn().mockReturnValue(identity);
    const providers = makeProviders({
      id: 'telegram',
      displayName: 'Telegram',
      verifyClientData,
    });
    const { controller, auth, merge } = makeController({ providers });
    auth.linkProviderToUser.mockResolvedValue({
      ok: false,
      conflictUserId: '555',
    });
    const res = await controller.linkProvider(
      'telegram',
      {},
      makeReq({ webUser: { userId: 5n } }),
    );
    expect(auth.buildMergeToken).toHaveBeenCalledWith(
      5n,
      555n,
      'telegram',
      'tg-1',
    );
    expect(merge.summarize).toHaveBeenCalledWith(555n);
    expect(res).toEqual({
      merge: true,
      mergeToken: 'merge-tok',
      summary: { Note: 3, Rating: 12 },
    });
  });
});

describe('AuthAccountController.unlink', () => {
  it('неизвестный провайдер → BadRequestException, unlinkProvider не вызывается', async () => {
    const providers = makeProviders(undefined, [
      { id: 'google', displayName: 'Google' },
    ]);
    const { controller, auth } = makeController({ providers });
    await expect(
      controller.unlink('vk', makeReq({ webUser: { userId: 1n } })),
    ).rejects.toThrow(BadRequestException);
    expect(auth.unlinkProvider).not.toHaveBeenCalled();
  });

  it('известный провайдер → отвязывает + аудит provider_unlinked', async () => {
    const providers = makeProviders(undefined, [
      { id: 'google', displayName: 'Google' },
      { id: 'telegram', displayName: 'Telegram' },
    ]);
    const { controller, auth, securityLog } = makeController({ providers });
    const req = makeReq({ webUser: { userId: 7n } });
    const res = await controller.unlink('google', req);
    expect(auth.unlinkProvider).toHaveBeenCalledWith(7n, 'google');
    expect(securityLog.log).toHaveBeenCalledWith('provider_unlinked', {
      userId: 7n,
      provider: 'google',
      ip: '198.51.100.1',
    });
    expect(res).toEqual({ ok: true });
  });
});
