// auth-flow.service.ts — общая логика sign-in/link/merge и OAuth-callback,
// вынесенная из auth.controller (см. комментарий в исходнике). Покрываем все
// три исхода signInOrLinkOrMerge (tokens/totp_challenge/merge), маршрутизацию
// finishOAuthRedirect, разбор state (linkUserIdFromState) и полный
// oauthCallback — включая ветки, где он ловит исключение и редиректит на
// /auth/error вместо того, чтобы бросить наружу (контроллер этого не ждёт).
// registry.ts (импортируется auth-flow.service.ts) тянет GoogleProvider, а тот —
// пакет 'jose' (чистый ESM, ts-jest его не парсит без спец-конфига). Здесь
// реальный GoogleProvider не нужен — регистр в тестах мокается целиком —
// поэтому подменяем модуль тем же способом, что и telegram.provider.spec.ts.
jest.mock('./providers/google.provider', () => ({ GoogleProvider: class {} }));

import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthFlowService, SignInOutcome } from './auth-flow.service';
import { AuthService, TokenPair } from './auth.service';
import { ConfigService } from '@nestjs/config';
import { AuthProviderRegistry } from './providers/registry';
import { MergeService } from './merge.service';
import { TotpService } from './totp.service';
import { AuthProviderHandler, ProviderIdentity } from './providers/types';

type AuthServiceMock = Pick<
  AuthService,
  | 'findOrCreateUserByProvider'
  | 'linkProviderToUser'
  | 'issueTokens'
  | 'buildTotpChallengeToken'
  | 'buildMergeToken'
> & {
  findOrCreateUserByProvider: jest.Mock;
  linkProviderToUser: jest.Mock;
  issueTokens: jest.Mock;
  buildTotpChallengeToken: jest.Mock;
  buildMergeToken: jest.Mock;
};

const FAKE_TOKENS: TokenPair = {
  accessToken: 'access-abc',
  refreshToken: 'refresh-abc',
  expiresIn: 900,
};

function makeAuth(): AuthServiceMock {
  return {
    findOrCreateUserByProvider: jest.fn().mockResolvedValue(1n),
    linkProviderToUser: jest.fn().mockResolvedValue({ ok: true }),
    issueTokens: jest.fn().mockResolvedValue(FAKE_TOKENS),
    buildTotpChallengeToken: jest.fn().mockReturnValue('totp-challenge-tok'),
    buildMergeToken: jest.fn().mockReturnValue('merge-tok'),
  };
}

function makeConfig(webappUrl = 'https://schemehappens.ru'): ConfigService {
  return {
    getOrThrow: jest.fn((key: string) => {
      if (key === 'WEBAPP_URL') return webappUrl;
      throw new Error(`unexpected config key ${key}`);
    }),
  } as unknown as ConfigService;
}

function makeRegistry(handler?: Partial<AuthProviderHandler>): {
  registry: AuthProviderRegistry;
  get: jest.Mock;
} {
  const get = jest.fn().mockReturnValue(handler);
  return { registry: { get } as unknown as AuthProviderRegistry, get };
}

function makeMerge(): MergeService & { summarize: jest.Mock } {
  return {
    summarize: jest.fn().mockResolvedValue({ Note: 3, Rating: 12 }),
  } as unknown as MergeService & { summarize: jest.Mock };
}

function makeTotp(enabled = false): TotpService & { isEnabled: jest.Mock } {
  return {
    isEnabled: jest.fn().mockResolvedValue(enabled),
  } as unknown as TotpService & { isEnabled: jest.Mock };
}

function makeService(opts: {
  auth?: AuthServiceMock;
  config?: ConfigService;
  registry?: AuthProviderRegistry;
  merge?: MergeService;
  totp?: TotpService;
}): AuthFlowService {
  const auth = opts.auth ?? makeAuth();
  const config = opts.config ?? makeConfig();
  const registry = opts.registry ?? makeRegistry().registry;
  const merge = opts.merge ?? makeMerge();
  const totp = opts.totp ?? makeTotp();
  return new AuthFlowService(
    auth as unknown as AuthService,
    config,
    registry,
    merge,
    totp,
  );
}

function makeIdentity(
  overrides: Partial<ProviderIdentity> = {},
): ProviderIdentity {
  return {
    providerId: 'g-42',
    displayName: 'Грег',
    email: 'greg@example.com',
    ...overrides,
  };
}

function makeRes(): Response & {
  cookie: jest.Mock;
  redirect: jest.Mock;
  clearCookie: jest.Mock;
} {
  return {
    cookie: jest.fn(),
    redirect: jest.fn(),
    clearCookie: jest.fn(),
  } as unknown as Response & {
    cookie: jest.Mock;
    redirect: jest.Mock;
    clearCookie: jest.Mock;
  };
}

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    cookies: {},
    ip: '198.51.100.1',
    ...overrides,
  } as unknown as Request;
}

describe('AuthFlowService.signInOrLinkOrMerge', () => {
  it('linkUserId=null, без 2FA → findOrCreate + issueTokens, исход "tokens"', async () => {
    const auth = makeAuth();
    const svc = makeService({ auth });
    const outcome = await svc.signInOrLinkOrMerge('google', makeIdentity(), {
      linkUserId: null,
      ip: '1.1.1.1',
      userAgent: 'ua',
    });
    expect(auth.findOrCreateUserByProvider).toHaveBeenCalledWith(
      'google',
      'g-42',
      'Грег',
      'greg@example.com',
    );
    expect(auth.issueTokens).toHaveBeenCalledWith(1n, '1.1.1.1', 'ua');
    expect(auth.buildTotpChallengeToken).not.toHaveBeenCalled();
    expect(outcome).toEqual({
      kind: 'tokens',
      userId: 1n,
      tokens: FAKE_TOKENS,
    });
  });

  it('linkUserId=null, 2FA включена → исход "totp_challenge", tokens НЕ выдаются', async () => {
    const auth = makeAuth();
    const totp = makeTotp(true);
    const svc = makeService({ auth, totp });
    const outcome = await svc.signInOrLinkOrMerge('google', makeIdentity(), {
      linkUserId: null,
      ip: '1.1.1.1',
      userAgent: 'ua',
    });
    expect(auth.issueTokens).not.toHaveBeenCalled();
    expect(auth.buildTotpChallengeToken).toHaveBeenCalledWith(
      1n,
      '1.1.1.1',
      'ua',
    );
    expect(outcome).toEqual({
      kind: 'totp_challenge',
      userId: 1n,
      challengeToken: 'totp-challenge-tok',
    });
  });

  it('linkUserId задан, конфликтов нет → линкует провайдера, issueTokens на linkUserId', async () => {
    const auth = makeAuth();
    const svc = makeService({ auth });
    const outcome = await svc.signInOrLinkOrMerge(
      'vk',
      makeIdentity({ providerId: 'vk-1' }),
      {
        linkUserId: 777n,
      },
    );
    expect(auth.linkProviderToUser).toHaveBeenCalledWith(
      777n,
      'vk',
      'vk-1',
      'Грег',
      'greg@example.com',
    );
    expect(auth.issueTokens).toHaveBeenCalledWith(777n, undefined, undefined);
    expect(outcome).toEqual({
      kind: 'tokens',
      userId: 777n,
      tokens: FAKE_TOKENS,
    });
  });

  it('linkUserId задан, providerId уже занят другим userId → исход "merge" с summary и otherDisplay', async () => {
    const auth = makeAuth();
    auth.linkProviderToUser.mockResolvedValue({
      ok: false,
      conflictUserId: '555',
    });
    const merge = makeMerge();
    const svc = makeService({ auth, merge });
    const outcome = await svc.signInOrLinkOrMerge('google', makeIdentity(), {
      linkUserId: 777n,
    });
    expect(auth.buildMergeToken).toHaveBeenCalledWith(
      777n,
      555n,
      'google',
      'g-42',
    );
    expect(merge.summarize).toHaveBeenCalledWith(555n);
    expect(outcome).toEqual({
      kind: 'merge',
      mergeToken: 'merge-tok',
      summary: { Note: 3, Rating: 12 },
      otherDisplay: 'Грег',
    });
  });

  it('merge-исход: otherDisplay падает на email, если displayName отсутствует', async () => {
    const auth = makeAuth();
    auth.linkProviderToUser.mockResolvedValue({
      ok: false,
      conflictUserId: '555',
    });
    const svc = makeService({ auth });
    const outcome = await svc.signInOrLinkOrMerge(
      'google',
      makeIdentity({ displayName: undefined }),
      { linkUserId: 777n },
    );
    expect(outcome).toEqual(
      expect.objectContaining({
        kind: 'merge',
        otherDisplay: 'greg@example.com',
      }),
    );
  });

  it('merge-исход: otherDisplay = null, если нет ни displayName, ни email', async () => {
    const auth = makeAuth();
    auth.linkProviderToUser.mockResolvedValue({
      ok: false,
      conflictUserId: '555',
    });
    const svc = makeService({ auth });
    const outcome = await svc.signInOrLinkOrMerge(
      'google',
      makeIdentity({ displayName: undefined, email: undefined }),
      { linkUserId: 777n },
    );
    expect(outcome).toEqual(
      expect.objectContaining({ kind: 'merge', otherDisplay: null }),
    );
  });
});

describe('AuthFlowService.finishOAuthRedirect', () => {
  const FRONTEND = 'https://schemehappens.ru';

  it('исход "merge" → редирект на /account/merge с токеном/summary/provider/name', () => {
    const svc = makeService({});
    const res = makeRes();
    const outcome: SignInOutcome = {
      kind: 'merge',
      mergeToken: 'mt-1',
      summary: { Note: 2 },
      otherDisplay: 'Грег',
    };
    svc.finishOAuthRedirect(outcome, 'google', res, FRONTEND);
    expect(res.cookie).not.toHaveBeenCalled();
    const url = res.redirect.mock.calls[0][0] as string;
    expect(url).toMatch(`${FRONTEND}/account/merge?`);
    expect(url).toContain('token=mt-1');
    expect(url).toContain('provider=google');
    expect(url).toContain(encodeURIComponent('Грег'));
  });

  it('исход "merge" с otherDisplay=null → name в query пустая строка, не "null"', () => {
    const svc = makeService({});
    const res = makeRes();
    const outcome: SignInOutcome = {
      kind: 'merge',
      mergeToken: 'mt-1',
      summary: { Note: 2 },
      otherDisplay: null,
    };
    svc.finishOAuthRedirect(outcome, 'google', res, FRONTEND);
    const url = res.redirect.mock.calls[0][0] as string;
    expect(url).toContain('name=');
    expect(url).not.toContain('null');
  });

  it('исход "totp_challenge" → редирект на /auth/2fa с challenge-токеном', () => {
    const svc = makeService({});
    const res = makeRes();
    const outcome: SignInOutcome = {
      kind: 'totp_challenge',
      userId: 1n,
      challengeToken: 'ch tok/weird',
    };
    svc.finishOAuthRedirect(outcome, 'google', res, FRONTEND);
    expect(res.redirect).toHaveBeenCalledWith(
      `${FRONTEND}/auth/2fa?token=${encodeURIComponent('ch tok/weird')}`,
    );
  });

  it('исход "tokens" → ставит REFRESH_COOKIE и редиректит на /auth/callback с access_token в хэше', () => {
    const svc = makeService({});
    const res = makeRes();
    const outcome: SignInOutcome = {
      kind: 'tokens',
      userId: 1n,
      tokens: FAKE_TOKENS,
    };
    svc.finishOAuthRedirect(outcome, 'google', res, FRONTEND);
    expect(res.cookie).toHaveBeenCalledWith(
      'refresh_token',
      FAKE_TOKENS.refreshToken,
      expect.objectContaining({ httpOnly: true, sameSite: 'strict' }),
    );
    expect(res.redirect).toHaveBeenCalledWith(
      `${FRONTEND}/auth/callback#access_token=${FAKE_TOKENS.accessToken}&expires_in=${FAKE_TOKENS.expiresIn}`,
    );
  });
});

describe('AuthFlowService.linkUserIdFromState', () => {
  const svc = makeService({});

  it('валидный base64url JSON с linkUserId → возвращает BigInt', () => {
    const state = Buffer.from(JSON.stringify({ linkUserId: '42' })).toString(
      'base64url',
    );
    expect(svc.linkUserIdFromState(state)).toBe(42n);
  });

  it('валидный JSON без linkUserId (анонимный вход) → null', () => {
    const state = Buffer.from(JSON.stringify({ nonce: 'x' })).toString(
      'base64url',
    );
    expect(svc.linkUserIdFromState(state)).toBeNull();
  });

  it('linkUserId: null явно в state → null', () => {
    const state = Buffer.from(JSON.stringify({ linkUserId: null })).toString(
      'base64url',
    );
    expect(svc.linkUserIdFromState(state)).toBeNull();
  });

  it('битый (не-JSON) state → null, не бросает', () => {
    expect(svc.linkUserIdFromState('not-valid-base64url-json!!!')).toBeNull();
  });
});

describe('AuthFlowService.oauthRedirect', () => {
  it('провайдер поддерживает buildAuthUrl → ставит oauth_state cookie и редиректит на authUrl', () => {
    const buildAuthUrl = jest
      .fn()
      .mockReturnValue('https://accounts.google.com/o/authorize?x=1');
    const { registry } = makeRegistry({
      id: 'google',
      displayName: 'Google',
      buildAuthUrl,
    });
    const svc = makeService({ registry });
    const res = makeRes();
    const req = makeReq({ webUser: { userId: 999n } });

    svc.oauthRedirect('google', req, res);

    expect(res.cookie).toHaveBeenCalledWith(
      'oauth_state',
      expect.any(String),
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        path: '/api/auth',
      }),
    );
    const state = res.cookie.mock.calls[0][1] as string;
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString()) as {
      linkUserId: string | null;
    };
    expect(decoded.linkUserId).toBe('999');
    expect(buildAuthUrl).toHaveBeenCalledWith(state);
    expect(res.redirect).toHaveBeenCalledWith(
      'https://accounts.google.com/o/authorize?x=1',
    );
  });

  it('анонимный запрос (без webUser) → linkUserId в state равен null', () => {
    const buildAuthUrl = jest.fn().mockReturnValue('https://x');
    const { registry } = makeRegistry({
      id: 'google',
      displayName: 'Google',
      buildAuthUrl,
    });
    const svc = makeService({ registry });
    const res = makeRes();
    const req = makeReq();

    svc.oauthRedirect('google', req, res);
    const state = res.cookie.mock.calls[0][1] as string;
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString()) as {
      linkUserId: string | null;
    };
    expect(decoded.linkUserId).toBeNull();
  });

  it('провайдер не поддерживает OAuth (нет buildAuthUrl) → BadRequestException', () => {
    const { registry } = makeRegistry({
      id: 'telegram',
      displayName: 'Telegram',
    });
    const svc = makeService({ registry });
    const res = makeRes();
    const req = makeReq();
    expect(() => svc.oauthRedirect('telegram', req, res)).toThrow(
      BadRequestException,
    );
    expect(res.redirect).not.toHaveBeenCalled();
  });
});

describe('AuthFlowService.oauthCallback', () => {
  const FRONTEND = 'https://schemehappens.ru';

  function makeHandler(
    overrides: Partial<AuthProviderHandler> = {},
  ): AuthProviderHandler {
    return {
      id: 'google',
      displayName: 'Google',
      exchangeCode: jest.fn().mockResolvedValue(makeIdentity()),
      ...overrides,
    };
  }

  it('успешный колбэк → обменивает код, вызывает signInOrLinkOrMerge и финиширует редиректом', async () => {
    const handler = makeHandler();
    const { registry } = makeRegistry(handler);
    const auth = makeAuth();
    const svc = makeService({ registry, auth, config: makeConfig(FRONTEND) });
    const res = makeRes();
    const state = Buffer.from(JSON.stringify({ linkUserId: null })).toString(
      'base64url',
    );
    const req = makeReq({ cookies: { oauth_state: state } });

    await svc.oauthCallback('google', 'code-1', state, '', req, res);

    expect(handler.exchangeCode).toHaveBeenCalledWith('code-1');
    expect(res.clearCookie).toHaveBeenCalledWith('oauth_state', {
      path: '/api/auth',
    });
    expect(res.cookie).toHaveBeenCalledWith(
      'refresh_token',
      FAKE_TOKENS.refreshToken,
      expect.anything(),
    );
    expect(res.redirect).toHaveBeenCalledWith(
      expect.stringContaining(`${FRONTEND}/auth/callback#`),
    );
  });

  it('provider с error-параметром (юзер отклонил) → редирект на /auth/error, без обмена кода', async () => {
    const handler = makeHandler();
    const { registry } = makeRegistry(handler);
    const svc = makeService({ registry, config: makeConfig(FRONTEND) });
    const res = makeRes();
    const req = makeReq();

    await svc.oauthCallback('google', '', '', 'access_denied', req, res);

    expect(handler.exchangeCode).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith(
      `${FRONTEND}/auth/error?reason=google_failed`,
    );
  });

  it('нет code или state → редирект на /auth/error (BadRequestException проглочен)', async () => {
    const handler = makeHandler();
    const { registry } = makeRegistry(handler);
    const svc = makeService({ registry, config: makeConfig(FRONTEND) });
    const res = makeRes();
    const req = makeReq();

    await svc.oauthCallback('google', '', '', '', req, res);
    expect(res.redirect).toHaveBeenCalledWith(
      `${FRONTEND}/auth/error?reason=google_failed`,
    );
  });

  it('oauth_state cookie не совпадает с переданным state → редирект на /auth/error', async () => {
    const handler = makeHandler();
    const { registry } = makeRegistry(handler);
    const svc = makeService({ registry, config: makeConfig(FRONTEND) });
    const res = makeRes();
    const req = makeReq({ cookies: { oauth_state: 'saved-state-value' } });

    await svc.oauthCallback(
      'google',
      'code-1',
      'different-state',
      '',
      req,
      res,
    );
    expect(handler.exchangeCode).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith(
      `${FRONTEND}/auth/error?reason=google_failed`,
    );
  });

  it('провайдер не поддерживает exchangeCode → редирект на /auth/error', async () => {
    const handler = makeHandler({ exchangeCode: undefined });
    const { registry } = makeRegistry(handler);
    const svc = makeService({ registry, config: makeConfig(FRONTEND) });
    const res = makeRes();
    const state = Buffer.from(JSON.stringify({ linkUserId: null })).toString(
      'base64url',
    );
    const req = makeReq({ cookies: { oauth_state: state } });

    await svc.oauthCallback('google', 'code-1', state, '', req, res);
    expect(res.redirect).toHaveBeenCalledWith(
      `${FRONTEND}/auth/error?reason=google_failed`,
    );
  });

  it('неизвестный провайдер (registry.get бросает) → редирект на /auth/error, не крашится', async () => {
    const get = jest.fn(() => {
      throw new Error('Unknown auth provider: mystery');
    });
    const registry = { get } as unknown as AuthProviderRegistry;
    const svc = makeService({ registry, config: makeConfig(FRONTEND) });
    const res = makeRes();
    const req = makeReq();

    await svc.oauthCallback('mystery', 'code-1', 'state-1', '', req, res);
    expect(res.redirect).toHaveBeenCalledWith(
      `${FRONTEND}/auth/error?reason=mystery_failed`,
    );
  });

  it('signInOrLinkOrMerge бросает (напр. UnauthorizedException из AuthService) → редирект на /auth/error', async () => {
    const handler = makeHandler();
    const { registry } = makeRegistry(handler);
    const auth = makeAuth();
    auth.findOrCreateUserByProvider.mockRejectedValue(
      new UnauthorizedException('boom'),
    );
    const svc = makeService({ registry, auth, config: makeConfig(FRONTEND) });
    const res = makeRes();
    const state = Buffer.from(JSON.stringify({ linkUserId: null })).toString(
      'base64url',
    );
    const req = makeReq({ cookies: { oauth_state: state } });

    await svc.oauthCallback('google', 'code-1', state, '', req, res);
    expect(res.redirect).toHaveBeenCalledWith(
      `${FRONTEND}/auth/error?reason=google_failed`,
    );
  });
});
