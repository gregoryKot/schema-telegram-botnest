// TEST_COVERAGE_PLAN.md, этап 1 п.6 (остаток): VkProvider — VK ID (OAuth 2.1 +
// PKCE). Регрессия здесь либо пускает подмену чужого VK-аккаунта (пропущенный
// PKCE-чек), либо ломает вход всем VK-юзерам. fetch мокается по паттерну
// robokassa.service.spec.ts (global.fetch = jest.fn(...)).
import { UnauthorizedException } from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { VkProvider } from './vk.provider';
import { fromVkState, toVkState } from './vk-state';

const CONFIG_MAP: Record<string, string> = {
  VK_APP_ID: '123456',
  VK_REDIRECT_URI: 'https://schemehappens.ru/api/auth/vk/callback',
};

/** Verifier шага 1 (в проде — случайный из куки vk_pkce, vk-pkce.ts). */
const V = 'v'.repeat(43);

function makeConfig(overrides: Record<string, string> = {}): ConfigService {
  const map = { ...CONFIG_MAP, ...overrides };
  return {
    getOrThrow: (key: string) => {
      if (!(key in map)) throw new Error(`missing config key: ${key}`);
      return map[key];
    },
  } as unknown as ConfigService;
}

function tokenOk(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    json: () => ({
      access_token: 'access-token-1',
      user_id: 555666,
      email: 'vk@example.com',
      ...overrides,
    }),
  };
}

function userInfoOk(first = 'Пётр', last = 'Иванов') {
  return {
    ok: true,
    json: () => ({ user: { first_name: first, last_name: last } }),
  };
}

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

describe('VkProvider.buildAuthUrl', () => {
  it('строит authorize-URL с PKCE-challenge (S256) и scope', () => {
    const provider = new VkProvider(makeConfig());
    const url = new URL(provider.buildAuthUrl('state-1', V));
    expect(url.origin + url.pathname).toBe('https://id.vk.com/authorize');
    const p = url.searchParams;
    expect(p.get('client_id')).toBe(CONFIG_MAP.VK_APP_ID);
    expect(p.get('redirect_uri')).toBe(CONFIG_MAP.VK_REDIRECT_URI);
    expect(p.get('response_type')).toBe('code');
    expect(p.get('state')).toBe(toVkState('state-1'));
    expect(p.get('code_challenge_method')).toBe('s256');
    expect(p.get('code_challenge')).toBeTruthy();
    // Телефон не запрашиваем: код его не читает (минимизация, 152-ФЗ).
    expect(p.get('scope')).toBe('email');
    expect(p.get('scope')).not.toContain('phone');
  });

  // 2026-10-03: VK вырезает из state всё, кроме [A-Za-z0-9_-] — точки JWT
  // терялись, и state не совпадал с кукой. Наружу state уходит без них.
  it('state JWT уходит к VK без точек и раскодируется обратно без потерь', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJsaW5rIjpudWxsfQ.sig-_A1';
    const sent = new URL(
      new VkProvider(makeConfig()).buildAuthUrl(jwt, V),
    ).searchParams.get('state')!;
    expect(sent).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(fromVkState(sent)).toBe(jwt);
  });

  it('callbackOrigin() = origin VK_REDIRECT_URI (2026-09-08: кука oauth_state обязана жить на этом хосте)', () => {
    const provider = new VkProvider(makeConfig());
    expect(provider.callbackOrigin()).toBe('https://schemehappens.ru');
  });
});

describe('VkProvider.exchangeCode (без контекста)', () => {
  it('всегда бросает — VK требует device_id/state через exchangeCodeWithContext', async () => {
    const provider = new VkProvider(makeConfig());
    // Бросает СИНХРОННО (метод не async, throw в теле) — .rejects тут не
    // подходит, ловим синхронное исключение.
    expect(() => provider.exchangeCode()).toThrow(
      'VkProvider.exchangeCode requires context',
    );
  });
});

// Аудит 2026-11, S21: verifier выводился из state (HMAC(JWT_SECRET, state)),
// а state не секрет — он виден в адресе. Теперь verifier случайный и живёт в
// httpOnly-куке шага 1 (vk-pkce.ts); провайдер получает его аргументом.
describe('VkProvider — PKCE-verifier из куки шага 1', () => {
  function sentBody(fetchMock: jest.Mock): URLSearchParams {
    const [, init] = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith('/oauth2/auth'),
    ) as [string, { body: string }];
    return new URLSearchParams(init.body);
  }

  const challengeOf = (verifier: string) =>
    createHash('sha256').update(verifier).digest('base64url');

  it('issueNonce кладёт случайный verifier в httpOnly-куку и challenge в authorize сходится с ним', () => {
    const res = { cookie: jest.fn() };
    const provider = new VkProvider(makeConfig());
    const verifier = provider.issueNonce(res as unknown as Response);
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(res.cookie).toHaveBeenCalledWith(
      'vk_pkce',
      verifier,
      expect.objectContaining({ httpOnly: true, path: '/api/auth' }),
    );
    const challenge = new URL(
      provider.buildAuthUrl('state-1', verifier),
    ).searchParams.get('code_challenge');
    expect(challenge).toBe(challengeOf(verifier));
  });

  it('verifier не выводится из state: два входа с одним state — разные verifier', () => {
    const provider = new VkProvider(makeConfig());
    const a = provider.issueNonce({ cookie: jest.fn() } as unknown as Response);
    const b = provider.issueNonce({ cookie: jest.fn() } as unknown as Response);
    expect(a).not.toBe(b);
  });

  it('без verifier authorize-URL не строится (громкий отказ, а не выдуманный verifier)', () => {
    expect(() => new VkProvider(makeConfig()).buildAuthUrl('state-1')).toThrow(
      'VK PKCE',
    );
  });

  it('обмен кода шлёт тот verifier, что пришёл из куки, и state в форме VK', async () => {
    const fetchMock = jest.fn((url: any) =>
      String(url).includes('user_info') ? userInfoOk() : tokenOk(),
    );
    global.fetch = fetchMock as any;
    const verifier = 'x'.repeat(43);
    const identity = await new VkProvider(makeConfig()).exchangeCodeWithContext(
      'code',
      'device-1',
      {
        state: 'state-cross',
        verifier,
      },
    );
    expect(identity.providerId).toBe('555666');
    expect(sentBody(fetchMock).get('code_verifier')).toBe(verifier);
    expect(sentBody(fetchMock).get('state')).toBe(toVkState('state-cross'));
  });
});

describe('VkProvider.exchangeCodeWithContext — happy path и профиль', () => {
  it('успешный обмен: providerId/email из токена, displayName — только имя из user_info', async () => {
    global.fetch = jest.fn((url: any) =>
      String(url).includes('user_info')
        ? userInfoOk('Анна', 'Смирнова')
        : tokenOk(),
    ) as any;
    const provider = new VkProvider(makeConfig());

    const identity = await provider.exchangeCodeWithContext(
      'code',
      'device-1',
      { state: 'state-happy', verifier: V },
    );
    // S16 (аудит 2026-11): displayName ляжет открытым в User.firstName —
    // только имя, фамилия VK туда не попадает.
    expect(identity).toEqual({
      providerId: '555666',
      email: 'vk@example.com',
      displayName: 'Анна',
    });
  });

  it('user_info вернул сеть-ошибку — не фатально: identity без displayName', async () => {
    global.fetch = jest.fn((url: any) => {
      if (String(url).includes('user_info')) throw new Error('network down');
      return tokenOk();
    }) as any;
    const provider = new VkProvider(makeConfig());

    const identity = await provider.exchangeCodeWithContext(
      'code',
      'device-1',
      { state: 'state-userinfo-fail', verifier: V },
    );
    expect(identity.providerId).toBe('555666');
    expect(identity.displayName).toBeUndefined();
  });

  it('user_info вернул not-ok HTTP — не фатально: identity без displayName', async () => {
    global.fetch = jest.fn((url: any) => {
      if (String(url).includes('user_info')) return { ok: false, status: 500 };
      return tokenOk();
    }) as any;
    const provider = new VkProvider(makeConfig());

    const identity = await provider.exchangeCodeWithContext(
      'code',
      'device-1',
      { state: 'state-userinfo-500', verifier: V },
    );
    expect(identity.displayName).toBeUndefined();
  });
});

describe('VkProvider.exchangeCodeWithContext — ошибки токен-обмена', () => {
  it('VK API вернул error в теле → UnauthorizedException с деталями', async () => {
    global.fetch = jest.fn(() => ({
      ok: true,
      json: () => ({
        error: 'invalid_grant',
        error_description: 'Authorization code expired',
      }),
    })) as any;
    const provider = new VkProvider(makeConfig());

    await expect(
      provider.exchangeCodeWithContext('code', 'device-1', {
        state: 'state-err',
        verifier: V,
      }),
    ).rejects.toThrow('Authorization code expired');
  });

  it('нет access_token в ответе → UnauthorizedException', async () => {
    global.fetch = jest.fn(() => ({
      ok: true,
      json: () => ({ user_id: 1 }),
    })) as any;
    const provider = new VkProvider(makeConfig());

    await expect(
      provider.exchangeCodeWithContext('code', 'device-1', {
        state: 'state-no-token',
        verifier: V,
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('нет user_id в ответе → UnauthorizedException', async () => {
    global.fetch = jest.fn(() => ({
      ok: true,
      json: () => ({ access_token: 'tok' }),
    })) as any;
    const provider = new VkProvider(makeConfig());

    await expect(
      provider.exchangeCodeWithContext('code', 'device-1', {
        state: 'state-no-uid',
        verifier: V,
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('сетевая ошибка на токен-эндпоинте пробрасывается наружу как есть (нет try/catch вокруг него)', async () => {
    global.fetch = jest.fn(() => {
      throw new Error('token endpoint unreachable');
    }) as any;
    const provider = new VkProvider(makeConfig());

    await expect(
      provider.exchangeCodeWithContext('code', 'device-1', {
        state: 'state-net-fail',
        verifier: V,
      }),
    ).rejects.toThrow('token endpoint unreachable');
  });

  it('невалидный JSON от токен-эндпоинта пробрасывается наружу (нет .catch на res.json())', async () => {
    global.fetch = jest.fn(() => ({
      ok: true,
      json: () => {
        throw new SyntaxError('Unexpected token');
      },
    })) as any;
    const provider = new VkProvider(makeConfig());

    await expect(
      provider.exchangeCodeWithContext('code', 'device-1', {
        state: 'state-malformed',
        verifier: V,
      }),
    ).rejects.toThrow(SyntaxError);
  });
});
