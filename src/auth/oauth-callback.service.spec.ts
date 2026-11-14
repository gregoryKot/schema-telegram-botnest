// Общий хвост OAuth-колбэков (VK, Яндекс): сверка state с кукой → обмен кода →
// вход/привязка → событие login_oauth → экран по исходу; любой отказ — экран
// `<id>_failed`. Здесь — на Яндексе со штатным exchangeCode; ветки VK (PKCE,
// device_id, state в base64url) — auth-oauth.controller.spec.ts, шов с
// настоящими AuthFlowService и AuthService — oauth-callback.seam.spec.ts.
import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import type { AnalyticsService } from '../analytics/analytics.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuthFlowService, SignInOutcome } from './auth-flow.service';
import type { AuthProviderRegistry } from './providers/registry';
import type { ProviderIdentity } from './providers/types';
import { OAuthCallbackService } from './oauth-callback.service';

const BASE = 'https://schemehappens.ru';
const FAILED = `${BASE}/auth/error?reason=yandex_failed`;
const STATE = 'eyJhbGciOiJIUzI1NiJ9.eyJraW5kIjoib2F1dGhfc3RhdGUifQ.c2ln';
const CODE = 'code16chars00000';
const YANDEX_ENV: Record<string, string> = {
  YANDEX_CLIENT_ID: 'id',
  YANDEX_CLIENT_SECRET: 'secret',
  YANDEX_REDIRECT_URI: `${BASE}/api/auth/yandex/callback`,
};
const IDENTITY: ProviderIdentity = {
  providerId: '1234567890',
  email: 'user@example.com',
  displayName: 'Иван',
};
const TOKENS: SignInOutcome = {
  kind: 'tokens',
  userId: 5n,
  tokens: { accessToken: 'a', refreshToken: 'r', expiresIn: 900 },
};

function setup(
  opts: {
    outcome?: SignInOutcome;
    linkUserId?: bigint | null;
    known?: boolean;
    ticket?: string | null;
    handler?: Record<string, unknown>;
    env?: Record<string, string>;
  } = {},
) {
  const handler = opts.handler ?? {
    id: 'yandex',
    exchangeCode: jest.fn().mockResolvedValue(IDENTITY),
    callbackOrigin: jest.fn().mockReturnValue(BASE),
  };
  const flow = {
    linkUserIdFromState: jest.fn().mockReturnValue(opts.linkUserId ?? null),
    ticketFromState: jest.fn().mockReturnValue(opts.ticket ?? null),
    signInOrLinkOrMerge: jest.fn().mockResolvedValue(opts.outcome ?? TOKENS),
    finishOAuthRedirect: jest.fn(),
  };
  const track = jest.fn().mockResolvedValue(undefined);
  const findUnique = jest.fn().mockResolvedValue(opts.known ? { id: 1 } : null);
  const service = new OAuthCallbackService(
    {
      get: (k: string) => (opts.env ?? YANDEX_ENV)[k],
      getOrThrow: () => BASE,
    } as unknown as ConfigService,
    { get: jest.fn(() => handler) } as unknown as AuthProviderRegistry,
    flow as unknown as AuthFlowService,
    { track } as unknown as AnalyticsService,
    { authProvider: { findUnique } } as unknown as PrismaService,
  );
  const res = { redirect: jest.fn(), clearCookie: jest.fn() };
  const req = (cookie: string | null = STATE) =>
    ({
      headers: { host: 'schemehappens.ru', 'user-agent': 'UA' },
      cookies: cookie ? { oauth_state: cookie } : {},
      ip: '203.0.113.7',
    }) as unknown as Request;
  const run = (
    query: { code?: string; state?: string; error?: unknown },
    cookie?: string | null,
  ) =>
    service.complete('yandex', req(cookie), res as unknown as Response, query);
  return { run, handler, flow, track, findUnique, res };
}

let logged: jest.SpyInstance;
beforeEach(() => {
  logged = jest.spyOn(Logger.prototype, 'error').mockImplementation();
});
afterEach(() => logged.mockRestore());

describe('OAuthCallbackService.complete — успех', () => {
  it('обмен кода → signInOrLinkOrMerge(yandex) → финал; кука state стёрта', async () => {
    const { run, handler, flow, res } = setup({ ticket: 'ABCD2345' });

    await run({ code: CODE, state: STATE });

    expect(handler.exchangeCode).toHaveBeenCalledWith(CODE);
    expect(res.clearCookie).toHaveBeenCalledWith('oauth_state', {
      path: '/api/auth',
    });
    expect(flow.signInOrLinkOrMerge).toHaveBeenCalledWith('yandex', IDENTITY, {
      linkUserId: null,
      ip: '203.0.113.7',
      userAgent: 'UA',
    });
    // Билет входа (вход начат в установленном приложении) доезжает до финала.
    expect(flow.finishOAuthRedirect).toHaveBeenCalledWith(
      TOKENS,
      'yandex',
      res,
      BASE,
      'ABCD2345',
    );
    expect(res.redirect).not.toHaveBeenCalled();
    expect(logged).not.toHaveBeenCalled();
  });

  it.each([
    ['входа у нас не было → новый аккаунт', {}, 'signed_up'],
    ['вход уже был → обычный вход', { known: true }, 'signed_in'],
    [
      'у аккаунта второй фактор',
      {
        known: true,
        outcome: { kind: 'totp_challenge', userId: 5n, challengeToken: 't' },
      },
      'twofa',
    ],
    ['привязка к своему аккаунту', { linkUserId: 5n }, 'linked'],
    [
      'вход занят другим аккаунтом → объединение',
      {
        linkUserId: 5n,
        outcome: {
          kind: 'merge',
          mergeToken: 'm',
          summary: {},
          twoFactorLost: false,
          otherDisplay: null,
        },
      },
      'merge',
    ],
  ] as const)('событие login_oauth: %s', async (_name, opts, outcome) => {
    const { run, track } = setup(opts as Parameters<typeof setup>[0]);
    await run({ code: CODE, state: STATE });
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith(null, 'login_oauth', {
      provider: 'yandex',
      outcome,
    });
  });

  it('при привязке «был ли вход» не спрашиваем: исход решает привязка', async () => {
    const { run, findUnique, track } = setup({ linkUserId: 5n, known: true });
    await run({ code: CODE, state: STATE });
    expect(findUnique).not.toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith(null, 'login_oauth', {
      provider: 'yandex',
      outcome: 'linked',
    });
  });
});

describe('OAuthCallbackService.complete — отказы ведут на yandex_failed', () => {
  const untouched = (s: ReturnType<typeof setup>) => {
    expect(s.handler.exchangeCode).not.toHaveBeenCalled();
    expect(s.flow.signInOrLinkOrMerge).not.toHaveBeenCalled();
    expect(s.flow.finishOAuthRedirect).not.toHaveBeenCalled();
    expect(s.track).not.toHaveBeenCalled();
    expect(s.res.redirect).toHaveBeenCalledWith(FAILED);
  };

  it('error в запросе (человек отказал) — в лог только код, обмена нет', async () => {
    const s = setup();
    await s.run({ error: 'access_denied', state: STATE });
    untouched(s);
    expect(logged).toHaveBeenCalledWith(
      'yandex callback error: yandex auth denied: access_denied',
    );
  });

  it('error с чужим текстом — в лог уходит unknown', async () => {
    const s = setup();
    await s.run({ error: 'Зайди на https://evil.example', state: STATE });
    untouched(s);
    expect(logged).toHaveBeenCalledWith(
      'yandex callback error: yandex auth denied: unknown',
    );
  });

  it('нет code — обмена нет', async () => {
    const s = setup();
    await s.run({ state: STATE });
    untouched(s);
    expect(logged).toHaveBeenCalledWith('yandex callback error: Missing code');
  });

  it('нет state — обмена нет, кука не трогается', async () => {
    const s = setup();
    await s.run({ code: CODE });
    untouched(s);
    expect(s.res.clearCookie).not.toHaveBeenCalled();
    expect(logged).toHaveBeenCalledWith('yandex callback error: Missing state');
  });

  it('state не совпал с кукой — обмена нет, кука остаётся', async () => {
    const s = setup();
    await s.run({ code: CODE, state: STATE }, 'other.state.value');
    untouched(s);
    expect(s.res.clearCookie).not.toHaveBeenCalled();
    expect(logged).toHaveBeenCalledWith(
      expect.stringContaining('OAuth state mismatch'),
    );
  });

  it('куки нет вовсе (истекла или другой браузер) — обмена нет', async () => {
    const s = setup();
    await s.run({ code: CODE, state: STATE }, null);
    untouched(s);
    expect(logged).toHaveBeenCalledWith(
      expect.stringContaining('OAuth state mismatch: кука не пришла'),
    );
  });

  it('площадка не обменяла код — кука уже стёрта, входа и события нет', async () => {
    const s = setup({
      handler: {
        id: 'yandex',
        exchangeCode: jest
          .fn()
          .mockRejectedValue(
            new Error('Yandex token error: invalid_grant (HTTP 400)'),
          ),
        callbackOrigin: () => BASE,
      },
    });
    await s.run({ code: CODE, state: STATE });
    expect(s.res.clearCookie).toHaveBeenCalledWith('oauth_state', {
      path: '/api/auth',
    });
    expect(s.flow.signInOrLinkOrMerge).not.toHaveBeenCalled();
    expect(s.track).not.toHaveBeenCalled();
    expect(s.res.redirect).toHaveBeenCalledWith(FAILED);
    expect(logged).toHaveBeenCalledWith(
      'yandex callback error: Yandex token error: invalid_grant (HTTP 400)',
    );
  });

  it('env провайдера снят — экран yandex_disabled, warn вместо error, обмена нет', async () => {
    const warned = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const s = setup({ env: {} });
    await s.run({ code: CODE, state: STATE });
    expect(s.res.redirect).toHaveBeenCalledWith(
      `${BASE}/auth/error?reason=yandex_disabled`,
    );
    expect(s.handler.exchangeCode).not.toHaveBeenCalled();
    expect(s.flow.signInOrLinkOrMerge).not.toHaveBeenCalled();
    expect(logged).not.toHaveBeenCalled();
    expect(warned).toHaveBeenCalledTimes(1);
    warned.mockRestore();
  });

  it('провайдер без обмена кода (Telegram, MAX) — отказ, а не падение', async () => {
    const s = setup({ handler: { id: 'telegram' } });
    await s.run({ code: CODE, state: STATE });
    expect(s.flow.signInOrLinkOrMerge).not.toHaveBeenCalled();
    expect(s.res.redirect).toHaveBeenCalledWith(FAILED);
  });

  it('вход не удался после обмена (сбой БД) — экран ошибки, события нет', async () => {
    const s = setup();
    s.flow.signInOrLinkOrMerge.mockRejectedValue(new Error('db down'));
    await s.run({ code: CODE, state: STATE });
    expect(s.track).not.toHaveBeenCalled();
    expect(s.res.redirect).toHaveBeenCalledWith(FAILED);
  });
});
