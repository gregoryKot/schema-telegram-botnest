// Покрытие AuthOauthController (был 0%): маршруты google/vk/telegram-oidc.
// Контроллер инстанцируется напрямую с typed test doubles (без TestingModule)
// — стиль auth.service.spec.ts. google-роуты — тонкие делегаты в
// AuthFlowService (проверяем сам факт и аргументы делегирования), vk и
// telegram-oidc содержат собственную PKCE/state-логику — она тестируется
// по существу (state → cookie → provider exchange → signInOrLinkOrMerge →
// finishOAuthRedirect), плюс основная guard-ветка (state mismatch/деним).
//
// registry.ts (импортируется контроллером для reflect-metadata design:paramtypes,
// нужного @Injectable) тянет GoogleProvider, а тот — пакет 'jose' (чистый ESM,
// ts-jest не умеет его парсить). Реальный GoogleProvider тут не нужен —
// подменяем модуль тем же способом, что и auth-flow.service.spec.ts /
// telegram.provider.spec.ts.
jest.mock('./providers/google.provider', () => ({ GoogleProvider: class {} }));

import type { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthOauthController } from './auth-oauth.controller';
import type { AuthProviderRegistry } from './providers/registry';
import type { AuthFlowService, SignInOutcome } from './auth-flow.service';
import type { VkProvider } from './providers/vk.provider';
import type { TelegramOidcProvider } from './providers/telegram-oidc.provider';
import type { ProviderIdentity } from './providers/types';

const WEBAPP_URL = 'https://schemehappens.ru';

interface FlowMocks {
  oauthRedirect: jest.Mock;
  oauthCallback: jest.Mock;
  signInOrLinkOrMerge: jest.Mock;
  finishOAuthRedirect: jest.Mock;
  linkUserIdFromState: jest.Mock;
}

interface ResMocks {
  redirect: jest.Mock;
  cookie: jest.Mock;
  clearCookie: jest.Mock;
}

function makeConfig(): ConfigService {
  const map: Record<string, string> = { WEBAPP_URL };
  return {
    getOrThrow: jest.fn((k: string) => map[k]),
  } as unknown as ConfigService;
}

function makeFlow(): { flow: AuthFlowService; mocks: FlowMocks } {
  const mocks: FlowMocks = {
    oauthRedirect: jest.fn(),
    oauthCallback: jest.fn().mockResolvedValue(undefined),
    signInOrLinkOrMerge: jest.fn(),
    finishOAuthRedirect: jest.fn(),
    linkUserIdFromState: jest.fn().mockReturnValue(null),
  };
  return { flow: mocks as unknown as AuthFlowService, mocks };
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
  const mocks: ResMocks = {
    redirect: jest.fn(),
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  };
  return { res: mocks as unknown as Response, mocks };
}

function makeController(
  providers: AuthProviderRegistry,
  flow: AuthFlowService,
  config: ConfigService = makeConfig(),
): AuthOauthController {
  return new AuthOauthController(config, providers, flow);
}

interface VkProviderMocks {
  exchangeCodeWithContext: jest.Mock;
}

function makeVkProvider(): { vk: VkProvider; mocks: VkProviderMocks } {
  const mocks: VkProviderMocks = { exchangeCodeWithContext: jest.fn() };
  return { vk: mocks as unknown as VkProvider, mocks };
}

interface TgOidcProviderMocks {
  generatePkce: jest.Mock;
  buildAuthUrl: jest.Mock;
  exchangeCodePkce: jest.Mock;
}

function makeTgOidcProvider(): {
  provider: TelegramOidcProvider;
  mocks: TgOidcProviderMocks;
} {
  const mocks: TgOidcProviderMocks = {
    generatePkce: jest
      .fn()
      .mockReturnValue({ verifier: 'verifier-1', challenge: 'challenge-1' }),
    buildAuthUrl: jest.fn(
      (state: string, challenge?: string) =>
        `https://oauth.telegram.org/auth?state=${state}&challenge=${String(challenge)}`,
    ),
    exchangeCodePkce: jest.fn(),
  };
  return { provider: mocks as unknown as TelegramOidcProvider, mocks };
}

const TOKENS_OUTCOME: SignInOutcome = {
  kind: 'tokens',
  userId: 999n,
  tokens: {
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    expiresIn: 900,
  },
};

describe('AuthOauthController.googleRedirect / vkRedirect — делегируют AuthFlowService.oauthRedirect', () => {
  it.each(['google', 'vk'] as const)(
    '%s: провайдер, req и res передаются как есть',
    (provider) => {
      const { flow, mocks } = makeFlow();
      const controller = makeController(makeProviders({}), flow);
      const req = makeReq();
      const { res } = makeRes();

      if (provider === 'google') controller.googleRedirect(req, res);
      else controller.vkRedirect(req, res);

      expect(mocks.oauthRedirect).toHaveBeenCalledWith(provider, req, res);
    },
  );
});

describe('AuthOauthController.googleCallback — делегирует AuthFlowService.oauthCallback', () => {
  it('пробрасывает code/state/error/req/res без изменений', async () => {
    const { flow, mocks } = makeFlow();
    const controller = makeController(makeProviders({}), flow);
    const req = makeReq();
    const { res } = makeRes();

    await controller.googleCallback('code-1', 'state-1', '', req, res);

    expect(mocks.oauthCallback).toHaveBeenCalledWith(
      'google',
      'code-1',
      'state-1',
      '',
      req,
      res,
    );
  });
});

describe('AuthOauthController.vkCallback', () => {
  it('успешный обмен: exchangeCodeWithContext → signInOrLinkOrMerge → finishOAuthRedirect, oauth_state очищается', async () => {
    const { flow, mocks } = makeFlow();
    const { vk, mocks: vkMocks } = makeVkProvider();
    const identity: ProviderIdentity = {
      providerId: '999',
      displayName: 'VK User',
    };
    vkMocks.exchangeCodeWithContext.mockResolvedValue(identity);
    mocks.signInOrLinkOrMerge.mockResolvedValue(TOKENS_OUTCOME);

    const controller = makeController(makeProviders({ vk }), flow);
    const req = makeReq({
      cookies: { oauth_state: 'state-1' },
    } as Partial<Request>);
    const { res, mocks: resMocks } = makeRes();

    await controller.vkCallback('code-1', 'state-1', 'device-1', '', req, res);

    expect(vkMocks.exchangeCodeWithContext).toHaveBeenCalledWith(
      'code-1',
      'device-1',
      'state-1',
    );
    expect(resMocks.clearCookie).toHaveBeenCalledWith('oauth_state', {
      path: '/api/auth',
    });
    expect(mocks.signInOrLinkOrMerge).toHaveBeenCalledWith('vk', identity, {
      linkUserId: null,
      ip: '1.2.3.4',
      userAgent: undefined,
    });
    expect(mocks.finishOAuthRedirect).toHaveBeenCalledWith(
      TOKENS_OUTCOME,
      'vk',
      res,
      WEBAPP_URL,
    );
  });

  it('state в query не совпадает с cookie oauth_state → редирект на /auth/error, провайдер не трогается дальше обмена', async () => {
    const { flow, mocks } = makeFlow();
    const { vk, mocks: vkMocks } = makeVkProvider();
    const controller = makeController(makeProviders({ vk }), flow);
    const req = makeReq({
      cookies: { oauth_state: 'other-state' },
    } as Partial<Request>);
    const { res, mocks: resMocks } = makeRes();

    await controller.vkCallback('code-1', 'state-1', 'device-1', '', req, res);

    expect(vkMocks.exchangeCodeWithContext).not.toHaveBeenCalled();
    expect(mocks.signInOrLinkOrMerge).not.toHaveBeenCalled();
    expect(resMocks.redirect).toHaveBeenCalledWith(
      `${WEBAPP_URL}/auth/error?reason=vk_failed`,
    );
  });

  it('провайдер вернул error (пользователь отказал) → редирект на /auth/error, exchangeCodeWithContext не вызывается', async () => {
    const { flow } = makeFlow();
    const { vk, mocks: vkMocks } = makeVkProvider();
    const controller = makeController(makeProviders({ vk }), flow);
    const req = makeReq({
      cookies: { oauth_state: 'state-1' },
    } as Partial<Request>);
    const { res, mocks: resMocks } = makeRes();

    await controller.vkCallback(
      'code-1',
      'state-1',
      'device-1',
      'access_denied',
      req,
      res,
    );

    expect(vkMocks.exchangeCodeWithContext).not.toHaveBeenCalled();
    expect(resMocks.redirect).toHaveBeenCalledWith(
      `${WEBAPP_URL}/auth/error?reason=vk_failed`,
    );
  });

  it('нет device_id → BadRequestException внутри, редирект на /auth/error без обмена кода', async () => {
    const { flow } = makeFlow();
    const { vk, mocks: vkMocks } = makeVkProvider();
    const controller = makeController(makeProviders({ vk }), flow);
    const req = makeReq({
      cookies: { oauth_state: 'state-1' },
    } as Partial<Request>);
    const { res, mocks: resMocks } = makeRes();

    await controller.vkCallback('code-1', 'state-1', '', '', req, res);

    expect(vkMocks.exchangeCodeWithContext).not.toHaveBeenCalled();
    expect(resMocks.redirect).toHaveBeenCalledWith(
      `${WEBAPP_URL}/auth/error?reason=vk_failed`,
    );
  });
});

describe('AuthOauthController.telegramOidcRedirect', () => {
  it('без webUser: state без linkUserId, обе cookie ставятся, редирект на buildAuthUrl(state, challenge)', () => {
    const { flow } = makeFlow();
    const { provider, mocks: tgMocks } = makeTgOidcProvider();
    const controller = makeController(
      makeProviders({ 'telegram-oidc': provider }),
      flow,
    );
    const req = makeReq();
    const { res, mocks: resMocks } = makeRes();

    controller.telegramOidcRedirect(req, res);

    expect(tgMocks.generatePkce).toHaveBeenCalled();
    expect(resMocks.cookie).toHaveBeenCalledWith(
      'oauth_state',
      expect.any(String),
      expect.objectContaining({ httpOnly: true }),
    );
    expect(resMocks.cookie).toHaveBeenCalledWith(
      'tg_pkce_verifier',
      'verifier-1',
      expect.objectContaining({ httpOnly: true }),
    );

    const stateArg = resMocks.cookie.mock.calls[0][1] as string;
    const decoded = JSON.parse(
      Buffer.from(stateArg, 'base64url').toString(),
    ) as { linkUserId: string | null };
    expect(decoded.linkUserId).toBeNull();

    expect(tgMocks.buildAuthUrl).toHaveBeenCalledWith(stateArg, 'challenge-1');
    expect(resMocks.redirect).toHaveBeenCalledWith(
      `https://oauth.telegram.org/auth?state=${stateArg}&challenge=challenge-1`,
    );
  });

  it('с webUser: state кодирует linkUserId как строку', () => {
    const { flow } = makeFlow();
    const { provider } = makeTgOidcProvider();
    const controller = makeController(
      makeProviders({ 'telegram-oidc': provider }),
      flow,
    );
    const req = makeReq({ webUser: { userId: 42n } } as Partial<Request>);
    const { res, mocks: resMocks } = makeRes();

    controller.telegramOidcRedirect(req, res);

    const stateArg = resMocks.cookie.mock.calls[0][1] as string;
    const decoded = JSON.parse(
      Buffer.from(stateArg, 'base64url').toString(),
    ) as { linkUserId: string | null };
    expect(decoded.linkUserId).toBe('42');
  });
});

describe('AuthOauthController.telegramOidcCallback', () => {
  it('успешный обмен: exchangeCodePkce → signInOrLinkOrMerge → finishOAuthRedirect, обе cookie очищаются', async () => {
    const { flow, mocks } = makeFlow();
    const { provider, mocks: tgMocks } = makeTgOidcProvider();
    const identity: ProviderIdentity = {
      providerId: 'tg-1',
      displayName: 'Tg User',
    };
    tgMocks.exchangeCodePkce.mockResolvedValue(identity);
    mocks.signInOrLinkOrMerge.mockResolvedValue(TOKENS_OUTCOME);

    const controller = makeController(
      makeProviders({ 'telegram-oidc': provider }),
      flow,
    );
    const req = makeReq({
      cookies: { oauth_state: 'state-1', tg_pkce_verifier: 'verifier-1' },
    } as Partial<Request>);
    const { res, mocks: resMocks } = makeRes();

    await controller.telegramOidcCallback('code-1', 'state-1', '', req, res);

    expect(tgMocks.exchangeCodePkce).toHaveBeenCalledWith(
      'code-1',
      'verifier-1',
    );
    expect(resMocks.clearCookie).toHaveBeenCalledWith('oauth_state', {
      path: '/api/auth',
    });
    expect(resMocks.clearCookie).toHaveBeenCalledWith('tg_pkce_verifier', {
      path: '/api/auth',
    });
    expect(mocks.finishOAuthRedirect).toHaveBeenCalledWith(
      TOKENS_OUTCOME,
      'telegram-oidc',
      res,
      WEBAPP_URL,
    );
  });

  it('нет cookie tg_pkce_verifier → UnauthorizedException внутри, редирект на /auth/error, exchangeCodePkce не вызывается', async () => {
    const { flow } = makeFlow();
    const { provider, mocks: tgMocks } = makeTgOidcProvider();
    const controller = makeController(
      makeProviders({ 'telegram-oidc': provider }),
      flow,
    );
    const req = makeReq({
      cookies: { oauth_state: 'state-1' },
    } as Partial<Request>);
    const { res, mocks: resMocks } = makeRes();

    await controller.telegramOidcCallback('code-1', 'state-1', '', req, res);

    expect(tgMocks.exchangeCodePkce).not.toHaveBeenCalled();
    expect(resMocks.redirect).toHaveBeenCalledWith(
      `${WEBAPP_URL}/auth/error?reason=telegram_oidc_failed`,
    );
  });

  it('state mismatch → редирект на /auth/error без обмена кода', async () => {
    const { flow } = makeFlow();
    const { provider, mocks: tgMocks } = makeTgOidcProvider();
    const controller = makeController(
      makeProviders({ 'telegram-oidc': provider }),
      flow,
    );
    const req = makeReq({
      cookies: { oauth_state: 'other-state', tg_pkce_verifier: 'verifier-1' },
    } as Partial<Request>);
    const { res, mocks: resMocks } = makeRes();

    await controller.telegramOidcCallback('code-1', 'state-1', '', req, res);

    expect(tgMocks.exchangeCodePkce).not.toHaveBeenCalled();
    expect(resMocks.redirect).toHaveBeenCalledWith(
      `${WEBAPP_URL}/auth/error?reason=telegram_oidc_failed`,
    );
  });
});

// Регрессия: throw в контроллере не должен утекать наружу как unhandled —
// UnauthorizedException должен быть перехвачен внутри try/catch колбэков.
describe('AuthOauthController — колбэки не пробрасывают исключения наружу', () => {
  it('vkCallback не бросает даже при полностью пустых query-параметрах', async () => {
    const { flow } = makeFlow();
    const { vk } = makeVkProvider();
    const controller = makeController(makeProviders({ vk }), flow);
    const req = makeReq();
    const { res } = makeRes();

    await expect(
      controller.vkCallback('', '', '', '', req, res),
    ).resolves.not.toThrow();
  });
});
