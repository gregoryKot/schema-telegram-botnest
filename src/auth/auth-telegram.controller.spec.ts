// Покрытие AuthTelegramController (был 0%): telegram/widget (POST + CSRF),
// telegram/redirect, telegram/widget-redirect. Контроллер инстанцируется
// напрямую с typed test doubles (без TestingModule) — стиль auth.service.spec.ts.
// telegram/widget — единственный CSRF-защищённый роут в auth/*: тестируем
// requireCsrf() отдельно как «гейт до БД» (см. CLAUDE.md «Обработка ошибок» —
// answerCbQuery/эквивалент до сайд-эффектов), плюс happy path и main guard-ветку
// каждого маршрута.
//
// registry.ts (импортируется контроллером для reflect-metadata design:paramtypes,
// нужного @Injectable) тянет GoogleProvider, а тот — пакет 'jose' (чистый ESM,
// ts-jest не умеет его парсить). Реальный GoogleProvider тут не нужен —
// подменяем модуль тем же способом, что и auth-flow.service.spec.ts /
// telegram.provider.spec.ts.
jest.mock('./providers/google.provider', () => ({ GoogleProvider: class {} }));

import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthTelegramController } from './auth-telegram.controller';
import type { AuthProviderRegistry } from './providers/registry';
import type { AuthFlowService, SignInOutcome } from './auth-flow.service';
import type { SecurityLogService } from './security-log.service';
import type { ProviderIdentity } from './providers/types';
import { REFRESH_COOKIE } from './auth-http.util';

const WEBAPP_URL = 'https://schemehappens.ru';
const BOT_TOKEN = '12345:TEST_SECRET';

interface FlowMocks {
  signInOrLinkOrMerge: jest.Mock;
  finishOAuthRedirect: jest.Mock;
}

interface SecurityLogMocks {
  log: jest.Mock;
}

interface ResMocks {
  redirect: jest.Mock;
  cookie: jest.Mock;
  clearCookie: jest.Mock;
  type: jest.Mock;
  send: jest.Mock;
}

interface TelegramProviderMocks {
  verifyClientData: jest.Mock;
}

function makeConfig(): ConfigService {
  const map: Record<string, string> = { WEBAPP_URL, BOT_TOKEN };
  return {
    getOrThrow: jest.fn((k: string) => map[k]),
  } as unknown as ConfigService;
}

function makeFlow(): { flow: AuthFlowService; mocks: FlowMocks } {
  const mocks: FlowMocks = {
    signInOrLinkOrMerge: jest.fn(),
    finishOAuthRedirect: jest.fn(),
  };
  return { flow: mocks as unknown as AuthFlowService, mocks };
}

function makeSecurityLog(): {
  securityLog: SecurityLogService;
  mocks: SecurityLogMocks;
} {
  const mocks: SecurityLogMocks = { log: jest.fn() };
  return { securityLog: mocks as unknown as SecurityLogService, mocks };
}

function makeTelegramProvider(): TelegramProviderMocks {
  return { verifyClientData: jest.fn() };
}

function makeProviders(
  handlers: Record<string, unknown>,
): AuthProviderRegistry {
  return {
    get: jest.fn((id: string) => handlers[id]),
  } as unknown as AuthProviderRegistry;
}

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    cookies: {},
    ip: '1.2.3.4',
    ...overrides,
  } as unknown as Request;
}

function makeRes(): { res: Response; mocks: ResMocks } {
  const mocks = {} as ResMocks;
  mocks.redirect = jest.fn();
  mocks.cookie = jest.fn();
  mocks.clearCookie = jest.fn();
  mocks.send = jest.fn();
  mocks.type = jest.fn(() => mocks as unknown as Response);
  return { res: mocks as unknown as Response, mocks };
}

function makeController(opts: {
  providers: AuthProviderRegistry;
  flow: AuthFlowService;
  securityLog?: SecurityLogService;
  config?: ConfigService;
}): AuthTelegramController {
  return new AuthTelegramController(
    opts.config ?? makeConfig(),
    opts.providers,
    opts.securityLog ?? makeSecurityLog().securityLog,
    opts.flow,
  );
}

const TOKENS_OUTCOME: SignInOutcome = {
  kind: 'tokens',
  userId: 555n,
  tokens: {
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    expiresIn: 900,
  },
};

describe('AuthTelegramController.telegramWidget — CSRF-гейт (requireCsrf ДО обращения к провайдеру/БД)', () => {
  it('нет x-requested-with и Content-Type не json → UnauthorizedException, провайдер и flow не тронуты', async () => {
    const telegram = makeTelegramProvider();
    const { flow, mocks: flowMocks } = makeFlow();
    const { securityLog, mocks: secMocks } = makeSecurityLog();
    const providers = makeProviders({ telegram });
    const controller = makeController({ providers, flow, securityLog });
    const req = makeReq({ headers: {} });
    const { res } = makeRes();

    await expect(controller.telegramWidget({}, req, res)).rejects.toThrow(
      UnauthorizedException,
    );

    expect(telegram.verifyClientData).not.toHaveBeenCalled();
    expect(flowMocks.signInOrLinkOrMerge).not.toHaveBeenCalled();
    expect(secMocks.log).toHaveBeenCalledWith(
      'csrf_blocked',
      expect.objectContaining({ endpoint: 'telegram/widget' }),
    );
  });

  it('x-requested-with присутствует → CSRF пройден, дальше идёт к провайдеру', async () => {
    const telegram = makeTelegramProvider();
    const identity: ProviderIdentity = {
      providerId: '555',
      displayName: 'Грег',
    };
    telegram.verifyClientData.mockReturnValue(identity);
    const { flow, mocks: flowMocks } = makeFlow();
    flowMocks.signInOrLinkOrMerge.mockResolvedValue(TOKENS_OUTCOME);
    const providers = makeProviders({ telegram });
    const controller = makeController({ providers, flow });
    const req = makeReq({
      headers: { 'x-requested-with': 'XMLHttpRequest' },
      body: { id: '555', hash: 'deadbeef' },
    } as Partial<Request>);
    const { res } = makeRes();

    const result = await controller.telegramWidget(
      { id: '555', hash: 'deadbeef' },
      req,
      res,
    );

    expect(telegram.verifyClientData).toHaveBeenCalledWith({
      id: '555',
      hash: 'deadbeef',
    });
    expect(result).toEqual({ accessToken: 'access-1', expiresIn: 900 });
  });
});

describe('AuthTelegramController.telegramWidget — провайдер без verifyClientData', () => {
  it('CSRF пройден, но провайдер не поддерживает прямую верификацию → BadRequestException', async () => {
    const telegram = { verifyClientData: undefined };
    const { flow } = makeFlow();
    const providers = makeProviders({ telegram });
    const controller = makeController({ providers, flow });
    const req = makeReq({
      headers: { 'x-requested-with': 'XMLHttpRequest' },
    } as Partial<Request>);
    const { res } = makeRes();

    await expect(controller.telegramWidget({}, req, res)).rejects.toThrow(
      BadRequestException,
    );
  });
});

describe('AuthTelegramController.telegramWidget — resolveLinkUserId и outcome-ветки', () => {
  function setup() {
    const telegram = makeTelegramProvider();
    const identity: ProviderIdentity = {
      providerId: '555',
      displayName: 'Грег',
    };
    telegram.verifyClientData.mockReturnValue(identity);
    const { flow, mocks: flowMocks } = makeFlow();
    const providers = makeProviders({ telegram });
    return { telegram, flow, flowMocks, providers };
  }

  it('req.webUser задан → linkUserId берётся из JWT, cookie tg_link_user всё равно очищается', async () => {
    const { flow, flowMocks, providers } = setup();
    flowMocks.signInOrLinkOrMerge.mockResolvedValue(TOKENS_OUTCOME);
    const controller = makeController({ providers, flow });
    const req = makeReq({
      headers: { 'x-requested-with': 'XMLHttpRequest' },
      webUser: { userId: 777n },
      cookies: { tg_link_user: '111' },
    } as Partial<Request>);
    const { res, mocks: resMocks } = makeRes();

    await controller.telegramWidget({}, req, res);

    expect(flowMocks.signInOrLinkOrMerge).toHaveBeenCalledWith(
      'telegram',
      expect.anything(),
      expect.objectContaining({ linkUserId: 777n }),
    );
    expect(resMocks.clearCookie).toHaveBeenCalledWith('tg_link_user', {
      path: '/api/auth',
    });
  });

  it('нет webUser, но есть cookie tg_link_user → linkUserId из cookie', async () => {
    const { flow, flowMocks, providers } = setup();
    flowMocks.signInOrLinkOrMerge.mockResolvedValue(TOKENS_OUTCOME);
    const controller = makeController({ providers, flow });
    const req = makeReq({
      headers: { 'x-requested-with': 'XMLHttpRequest' },
      cookies: { tg_link_user: '222' },
    } as Partial<Request>);
    const { res } = makeRes();

    await controller.telegramWidget({}, req, res);

    expect(flowMocks.signInOrLinkOrMerge).toHaveBeenCalledWith(
      'telegram',
      expect.anything(),
      expect.objectContaining({ linkUserId: 222n }),
    );
  });

  it('нет ни webUser, ни cookie → linkUserId = null (обычный вход)', async () => {
    const { flow, flowMocks, providers } = setup();
    flowMocks.signInOrLinkOrMerge.mockResolvedValue(TOKENS_OUTCOME);
    const controller = makeController({ providers, flow });
    const req = makeReq({
      headers: { 'x-requested-with': 'XMLHttpRequest' },
    } as Partial<Request>);
    const { res } = makeRes();

    await controller.telegramWidget({}, req, res);

    expect(flowMocks.signInOrLinkOrMerge).toHaveBeenCalledWith(
      'telegram',
      expect.anything(),
      expect.objectContaining({ linkUserId: null }),
    );
  });

  it('outcome=merge → возвращает merge-payload, токены/cookie не выставляются', async () => {
    const { flow, flowMocks, providers } = setup();
    const mergeOutcome: SignInOutcome = {
      kind: 'merge',
      mergeToken: 'merge-tok',
      summary: { notes: 3 },
      otherDisplay: 'Old Name',
    };
    flowMocks.signInOrLinkOrMerge.mockResolvedValue(mergeOutcome);
    const controller = makeController({ providers, flow });
    const req = makeReq({
      headers: { 'x-requested-with': 'XMLHttpRequest' },
    } as Partial<Request>);
    const { res, mocks: resMocks } = makeRes();

    const result = await controller.telegramWidget({}, req, res);

    expect(result).toEqual({
      merge: true,
      mergeToken: 'merge-tok',
      summary: { notes: 3 },
      otherDisplay: 'Old Name',
      provider: 'telegram',
    });
    expect(resMocks.cookie).not.toHaveBeenCalled();
  });

  it('outcome=totp_challenge → возвращает challengeToken', async () => {
    const { flow, flowMocks, providers } = setup();
    flowMocks.signInOrLinkOrMerge.mockResolvedValue({
      kind: 'totp_challenge',
      userId: 555n,
      challengeToken: 'chal-1',
    });
    const controller = makeController({ providers, flow });
    const req = makeReq({
      headers: { 'x-requested-with': 'XMLHttpRequest' },
    } as Partial<Request>);
    const { res } = makeRes();

    const result = await controller.telegramWidget({}, req, res);

    expect(result).toEqual({ totp: true, challengeToken: 'chal-1' });
  });

  it('outcome=tokens → ставит refresh_token cookie и возвращает accessToken/expiresIn', async () => {
    const { flow, flowMocks, providers } = setup();
    flowMocks.signInOrLinkOrMerge.mockResolvedValue(TOKENS_OUTCOME);
    const controller = makeController({ providers, flow });
    const req = makeReq({
      headers: { 'x-requested-with': 'XMLHttpRequest' },
    } as Partial<Request>);
    const { res, mocks: resMocks } = makeRes();

    const result = await controller.telegramWidget({}, req, res);

    expect(resMocks.cookie).toHaveBeenCalledWith(
      REFRESH_COOKIE,
      'refresh-1',
      expect.objectContaining({ httpOnly: true }),
    );
    expect(result).toEqual({ accessToken: 'access-1', expiresIn: 900 });
  });
});

describe('AuthTelegramController.telegramRedirect', () => {
  it('без webUser: редирект на oauth.telegram.org с bot_id/origin/return_to, cookie не ставится', () => {
    const { flow } = makeFlow();
    const controller = makeController({ providers: makeProviders({}), flow });
    const req = makeReq();
    const { res, mocks: resMocks } = makeRes();

    controller.telegramRedirect(req, res);

    expect(resMocks.cookie).not.toHaveBeenCalled();
    const url = resMocks.redirect.mock.calls[0][0] as string;
    expect(url).toContain('https://oauth.telegram.org/auth?bot_id=12345');
    expect(url).toContain(`origin=${encodeURIComponent(WEBAPP_URL)}`);
    expect(url).toContain(
      `return_to=${encodeURIComponent(`${WEBAPP_URL}/auth/telegram`)}`,
    );
  });

  it('с webUser: ставит tg_link_user cookie со строковым userId', () => {
    const { flow } = makeFlow();
    const controller = makeController({ providers: makeProviders({}), flow });
    const req = makeReq({ webUser: { userId: 777n } } as Partial<Request>);
    const { res, mocks: resMocks } = makeRes();

    controller.telegramRedirect(req, res);

    expect(resMocks.cookie).toHaveBeenCalledWith(
      'tg_link_user',
      '777',
      expect.objectContaining({ httpOnly: true }),
    );
  });
});

describe('AuthTelegramController.telegramWidgetRedirect', () => {
  it('пустой query → отдаёт HTML-трамплин без обращения к провайдеру/flow', async () => {
    const telegram = makeTelegramProvider();
    const { flow, mocks: flowMocks } = makeFlow();
    const providers = makeProviders({ telegram });
    const controller = makeController({ providers, flow });
    const req = makeReq();
    const { res, mocks: resMocks } = makeRes();

    await controller.telegramWidgetRedirect({}, req, res);

    expect(resMocks.type).toHaveBeenCalledWith('text/html');
    expect(resMocks.send).toHaveBeenCalledWith(
      expect.stringContaining('tgAuthResult'),
    );
    expect(telegram.verifyClientData).not.toHaveBeenCalled();
    expect(flowMocks.signInOrLinkOrMerge).not.toHaveBeenCalled();
  });

  it('query с tgAuthResult (base64url JSON) → декодируется в плоские поля перед verifyClientData', async () => {
    const telegram = makeTelegramProvider();
    const identity: ProviderIdentity = {
      providerId: '555',
      displayName: 'Грег',
    };
    telegram.verifyClientData.mockReturnValue(identity);
    const { flow, mocks: flowMocks } = makeFlow();
    flowMocks.signInOrLinkOrMerge.mockResolvedValue(TOKENS_OUTCOME);
    const providers = makeProviders({ telegram });
    const controller = makeController({ providers, flow });

    const payload = { id: 555, first_name: 'Грег', hash: 'deadbeef' };
    const tgAuthResult = Buffer.from(JSON.stringify(payload)).toString(
      'base64url',
    );
    const req = makeReq();
    const { res, mocks: resMocks } = makeRes();

    await controller.telegramWidgetRedirect({ tgAuthResult }, req, res);

    expect(telegram.verifyClientData).toHaveBeenCalledWith({
      id: '555',
      first_name: 'Грег',
      hash: 'deadbeef',
    });
    expect(flowMocks.finishOAuthRedirect).toHaveBeenCalledWith(
      TOKENS_OUTCOME,
      'telegram',
      res,
      WEBAPP_URL,
    );
    expect(resMocks.type).not.toHaveBeenCalled();
  });

  it('плоский query (без tgAuthResult) → verifyClientData получает query как есть', async () => {
    const telegram = makeTelegramProvider();
    const identity: ProviderIdentity = { providerId: '555' };
    telegram.verifyClientData.mockReturnValue(identity);
    const { flow, mocks: flowMocks } = makeFlow();
    flowMocks.signInOrLinkOrMerge.mockResolvedValue(TOKENS_OUTCOME);
    const providers = makeProviders({ telegram });
    const controller = makeController({ providers, flow });
    const query = { id: '555', hash: 'deadbeef' };
    const req = makeReq();
    const { res } = makeRes();

    await controller.telegramWidgetRedirect(query, req, res);

    expect(telegram.verifyClientData).toHaveBeenCalledWith(query);
  });

  it('битый (не-JSON) tgAuthResult → редирект на /auth/error с причиной, verifyClientData не вызывается', async () => {
    const telegram = makeTelegramProvider();
    const { flow } = makeFlow();
    const providers = makeProviders({ telegram });
    const controller = makeController({ providers, flow });
    const req = makeReq();
    const { res, mocks: resMocks } = makeRes();

    await controller.telegramWidgetRedirect(
      { tgAuthResult: 'not-valid-base64url-json!!!' },
      req,
      res,
    );

    expect(telegram.verifyClientData).not.toHaveBeenCalled();
    const url = resMocks.redirect.mock.calls[0][0] as string;
    expect(url).toContain(`${WEBAPP_URL}/auth/error?reason=`);
  });

  it('провайдер без verifyClientData → редирект на /auth/error, flow не трогается', async () => {
    const telegram = { verifyClientData: undefined };
    const { flow, mocks: flowMocks } = makeFlow();
    const providers = makeProviders({ telegram });
    const controller = makeController({ providers, flow });
    const req = makeReq();
    const { res, mocks: resMocks } = makeRes();

    await controller.telegramWidgetRedirect({ id: '555' }, req, res);

    expect(flowMocks.signInOrLinkOrMerge).not.toHaveBeenCalled();
    expect(resMocks.redirect).toHaveBeenCalledWith(
      expect.stringContaining(`${WEBAPP_URL}/auth/error?reason=`),
    );
  });
});
