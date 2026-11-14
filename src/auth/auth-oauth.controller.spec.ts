// Покрытие AuthOauthController (был 0%): маршруты vk и yandex.
// Контроллер инстанцируется напрямую с typed test doubles (без TestingModule)
// — стиль auth.service.spec.ts. Старт — тонкий делегат в AuthFlowService
// (проверяем сам факт и аргументы делегирования). Колбэк идёт через НАСТОЯЩИЙ
// общий хвост OAuthCallbackService (2026-11: вынесен из vkCallback, им же
// пользуется Яндекс) — PKCE/state-логика тестируется по существу (state →
// cookie → provider exchange → signInOrLinkOrMerge → finishOAuthRedirect),
// плюс основная guard-ветка (state mismatch/деним). Сам хвост и его событие
// аналитики — oauth-callback.service.spec.ts.
import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthOauthController } from './auth-oauth.controller';
import { OAuthCallbackService } from './oauth-callback.service';
import type { AuthProviderRegistry } from './providers/registry';
import type { AuthFlowService, SignInOutcome } from './auth-flow.service';
import { VkProvider } from './providers/vk.provider';
import { toVkState } from './providers/vk-state';
import type { ProviderIdentity } from './providers/types';

const WEBAPP_URL = 'https://schemehappens.ru';

interface FlowMocks {
  oauthRedirect: jest.Mock;
  signInOrLinkOrMerge: jest.Mock;
  finishOAuthRedirect: jest.Mock;
  linkUserIdFromState: jest.Mock;
  ticketFromState: jest.Mock;
  buildLinkState: jest.Mock;
  readLinkState: jest.Mock;
}

interface ResMocks {
  redirect: jest.Mock;
  cookie: jest.Mock;
  clearCookie: jest.Mock;
}

function makeConfig(): ConfigService {
  const map: Record<string, string> = {
    WEBAPP_URL,
    VK_APP_ID: '1',
    VK_REDIRECT_URI: `${WEBAPP_URL}/api/auth/vk/callback`,
    YANDEX_CLIENT_ID: 'id',
    YANDEX_CLIENT_SECRET: 'secret',
    YANDEX_REDIRECT_URI: `${WEBAPP_URL}/api/auth/yandex/callback`,
  };
  return {
    get: jest.fn((k: string) => map[k]),
    getOrThrow: jest.fn((k: string) => map[k]),
  } as unknown as ConfigService;
}

function makeFlow(): { flow: AuthFlowService; mocks: FlowMocks } {
  const mocks: FlowMocks = {
    oauthRedirect: jest.fn(),
    signInOrLinkOrMerge: jest.fn(),
    finishOAuthRedirect: jest.fn(),
    linkUserIdFromState: jest.fn().mockReturnValue(null),
    // Билет входа: у обычного веб-логина его нет, у входа из установленного
    // приложения — есть, и он едет пятым аргументом в finishOAuthRedirect.
    ticketFromState: jest.fn().mockReturnValue(null),
    buildLinkState: jest.fn().mockReturnValue('signed-oauth-state'),
    readLinkState: jest.fn().mockReturnValue(null),
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
  // Отчёт о входе (событие login_oauth) здесь не предмет теста — заглушки.
  const analytics = { track: jest.fn() };
  const prisma = {
    authProvider: { findUnique: jest.fn().mockResolvedValue(null) },
  };
  const callback = new OAuthCallbackService(
    config,
    providers,
    flow,
    analytics as never,
    prisma as never,
  );
  return new AuthOauthController(flow, callback);
}

interface VkProviderMocks {
  exchangeCodeWithContext: jest.Mock;
  callbackOrigin: jest.Mock;
}

function makeVkProvider(): { vk: VkProvider; mocks: VkProviderMocks } {
  const mocks: VkProviderMocks = {
    exchangeCodeWithContext: jest.fn(),
    // callbackOrigin — origin VK_REDIRECT_URI (2026-09-08): assertOAuthStateMatches
    // требует его для классификации отказа. Дефолт совпадает с WEBAPP_URL из
    // makeConfig, чтобы тесты, не завязанные на алиас-домен, не различали хосты.
    callbackOrigin: jest.fn().mockReturnValue(WEBAPP_URL),
  };
  return { vk: mocks as unknown as VkProvider, mocks };
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

describe('AuthOauthController.vkRedirect — делегирует AuthFlowService.oauthRedirect', () => {
  it('провайдер, req и res передаются как есть', () => {
    const { flow, mocks } = makeFlow();
    const controller = makeController(makeProviders({}), flow);
    const req = makeReq();
    const { res } = makeRes();

    controller.vkRedirect(req, res);

    expect(mocks.oauthRedirect).toHaveBeenCalledWith('vk', req, res);
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
    const verifier = 'p'.repeat(43);
    const req = makeReq({
      cookies: { oauth_state: 'state-1', vk_pkce: verifier },
    } as Partial<Request>);
    const { res, mocks: resMocks } = makeRes();

    await controller.vkCallback(
      'code-1',
      toVkState('state-1'),
      'device-1',
      '',
      req,
      res,
    );

    // PKCE-верификатор — из куки шага 1 (аудит 2026-11, S21), кука стирается.
    expect(vkMocks.exchangeCodeWithContext).toHaveBeenCalledWith(
      'code-1',
      'device-1',
      { state: 'state-1', verifier },
    );
    expect(resMocks.clearCookie).toHaveBeenCalledWith('oauth_state', {
      path: '/api/auth',
    });
    expect(resMocks.clearCookie).toHaveBeenCalledWith('vk_pkce', {
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
      null,
    );
  });

  it('S21: кука vk_pkce не пришла (истекла/другой браузер) → vk_failed, обмена кода нет', async () => {
    const { flow, mocks } = makeFlow();
    const { vk, mocks: vkMocks } = makeVkProvider();
    const controller = makeController(makeProviders({ vk }), flow);
    const req = makeReq({
      cookies: { oauth_state: 'state-1' },
    } as Partial<Request>);
    const { res, mocks: resMocks } = makeRes();
    const err = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    await controller.vkCallback(
      'code-1',
      toVkState('state-1'),
      'device-1',
      '',
      req,
      res,
    );

    expect(vkMocks.exchangeCodeWithContext).not.toHaveBeenCalled();
    expect(mocks.signInOrLinkOrMerge).not.toHaveBeenCalled();
    expect(resMocks.redirect).toHaveBeenCalledWith(
      `${WEBAPP_URL}/auth/error?reason=vk_failed`,
    );
    expect(err).toHaveBeenCalledWith(
      expect.stringContaining('VK PKCE'),
      expect.any(Error),
    );
    err.mockRestore();
  });

  it('state в query не совпадает с cookie oauth_state → редирект на /auth/error, провайдер не трогается дальше обмена', async () => {
    const { flow, mocks } = makeFlow();
    const { vk, mocks: vkMocks } = makeVkProvider();
    const controller = makeController(makeProviders({ vk }), flow);
    const req = makeReq({
      cookies: { oauth_state: 'other-state' },
    } as Partial<Request>);
    const { res, mocks: resMocks } = makeRes();

    await controller.vkCallback(
      'code-1',
      toVkState('state-1'),
      'device-1',
      '',
      req,
      res,
    );

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
      toVkState('state-1'),
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

  // S21 (аудит 2026-11): `?error=` присылает браузер — сырой текст уходил в
  // error(), а оттуда в DM владельцу. Код провайдера проходит, прочее — unknown.
  it.each([
    ['access_denied', 'vk auth denied: access_denied'],
    ['Зайди на https://evil.example', 'vk auth denied: unknown'],
    ['x'.repeat(41), 'vk auth denied: unknown'],
    [['a', 'b'], 'vk auth denied: unknown'],
  ])('error=%p → в лог и DM только код: %s', async (raw, logged) => {
    const err = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const { flow } = makeFlow();
    const { vk } = makeVkProvider();
    const controller = makeController(makeProviders({ vk }), flow);
    const { res } = makeRes();
    await controller.vkCallback(
      'code-1',
      toVkState('state-1'),
      'device-1',
      raw as string,
      makeReq({ cookies: { oauth_state: 'state-1' } } as Partial<Request>),
      res,
    );
    expect(err).toHaveBeenCalledWith(
      `vk callback error: ${logged}`,
      expect.any(Error),
    );
    err.mockRestore();
  });

  it('нет device_id → BadRequestException внутри, редирект на /auth/error без обмена кода', async () => {
    const { flow } = makeFlow();
    const { vk, mocks: vkMocks } = makeVkProvider();
    const controller = makeController(makeProviders({ vk }), flow);
    const req = makeReq({
      cookies: { oauth_state: 'state-1' },
    } as Partial<Request>);
    const { res, mocks: resMocks } = makeRes();

    await controller.vkCallback(
      'code-1',
      toVkState('state-1'),
      '',
      '',
      req,
      res,
    );

    expect(vkMocks.exchangeCodeWithContext).not.toHaveBeenCalled();
    expect(resMocks.redirect).toHaveBeenCalledWith(
      `${WEBAPP_URL}/auth/error?reason=vk_failed`,
    );
  });
  // Инцидент 2026-10-03: VK пропускает в state только [A-Za-z0-9_-] и молча
  // вырезает остальное. Подписанный state — JWT с двумя точками; вернувшись
  // без них, он не совпадал с кукой, и каждый вход через VK падал vk_failed.
  // Тест идёт через шов: настоящий buildAuthUrl → то, что вернёт VK →
  // настоящий колбэк.
  it('state, прошедший через VK (точки вырезаны), совпадает с кукой oauth_state', async () => {
    const { flow, mocks } = makeFlow();
    mocks.signInOrLinkOrMerge.mockResolvedValue(TOKENS_OUTCOME);
    const jwtLike = 'eyJhbGciOiJIUzI1NiJ9.eyJraW5kIjoib2F1dGhfc3RhdGUifQ.c2ln';
    const real = new VkProvider({
      getOrThrow: (k: string) =>
        ({
          VK_APP_ID: '1',
          VK_REDIRECT_URI: `${WEBAPP_URL}/api/auth/vk/callback`,
        })[k],
    } as unknown as ConfigService);
    const verifier = 'q'.repeat(43);
    const sent = new URL(real.buildAuthUrl(jwtLike, verifier)).searchParams.get(
      'state',
    )!;
    const vkReturns = sent.replace(/[^A-Za-z0-9_-]/g, '');
    expect(vkReturns).toBe(sent);

    const exchange = jest
      .spyOn(real, 'exchangeCodeWithContext')
      .mockResolvedValue({ providerId: '1' });
    const controller = makeController(makeProviders({ vk: real }), flow);
    const req = makeReq({
      cookies: { oauth_state: jwtLike, vk_pkce: verifier },
    } as Partial<Request>);
    const { res } = makeRes();

    await controller.vkCallback('code-1', vkReturns, 'device-1', '', req, res);

    expect(exchange).toHaveBeenCalledWith('code-1', 'device-1', {
      state: jwtLike,
      verifier,
    });
    expect(mocks.finishOAuthRedirect).toHaveBeenCalled();
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

describe('AuthOauthController — Яндекс ID', () => {
  it('yandexRedirect делегирует AuthFlowService.oauthRedirect', () => {
    const { flow, mocks } = makeFlow();
    const controller = makeController(makeProviders({}), flow);
    const req = makeReq();
    const { res } = makeRes();

    controller.yandexRedirect(req, res);

    expect(mocks.oauthRedirect).toHaveBeenCalledWith('yandex', req, res);
  });

  it('yandexCallback: code из запроса уходит в exchangeCode провайдера, исход — в общий финал', async () => {
    const { flow, mocks } = makeFlow();
    mocks.signInOrLinkOrMerge.mockResolvedValue(TOKENS_OUTCOME);
    const identity: ProviderIdentity = { providerId: '1234567890' };
    const yandex = {
      id: 'yandex',
      exchangeCode: jest.fn().mockResolvedValue(identity),
      callbackOrigin: jest.fn().mockReturnValue(WEBAPP_URL),
    };
    const controller = makeController(makeProviders({ yandex }), flow);
    const req = makeReq({
      cookies: { oauth_state: 'a.b.c' },
    } as Partial<Request>);
    const { res, mocks: resMocks } = makeRes();

    // cid и error_description площадка присылает, а хвост их не читает.
    await controller.yandexCallback(
      { code: 'code16chars00000', state: 'a.b.c', cid: 'x'.repeat(26) },
      req,
      res,
    );

    expect(yandex.exchangeCode).toHaveBeenCalledWith('code16chars00000');
    expect(resMocks.clearCookie).toHaveBeenCalledWith('oauth_state', {
      path: '/api/auth',
    });
    expect(mocks.signInOrLinkOrMerge).toHaveBeenCalledWith('yandex', identity, {
      linkUserId: null,
      ip: '1.2.3.4',
      userAgent: undefined,
    });
    expect(mocks.finishOAuthRedirect).toHaveBeenCalledWith(
      TOKENS_OUTCOME,
      'yandex',
      res,
      WEBAPP_URL,
      null,
    );
  });

  it('yandexCallback с пустым запросом не бросает — экран yandex_failed', async () => {
    const err = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const { flow } = makeFlow();
    const controller = makeController(makeProviders({ yandex: {} }), flow);
    const { res, mocks: resMocks } = makeRes();

    await expect(
      controller.yandexCallback({}, makeReq(), res),
    ).resolves.toBeUndefined();

    expect(resMocks.redirect).toHaveBeenCalledWith(
      `${WEBAPP_URL}/auth/error?reason=yandex_failed`,
    );
    err.mockRestore();
  });
});
