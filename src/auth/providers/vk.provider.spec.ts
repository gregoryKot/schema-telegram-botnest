// TEST_COVERAGE_PLAN.md, этап 1 п.6 (остаток): VkProvider — VK ID (OAuth 2.1 +
// PKCE). Регрессия здесь либо пускает подмену чужого VK-аккаунта (пропущенный
// PKCE-чек), либо ломает вход всем VK-юзерам. fetch мокается по паттерну
// robokassa.service.spec.ts (global.fetch = jest.fn(...)).
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { VkProvider } from './vk.provider';

const CONFIG_MAP: Record<string, string> = {
  VK_APP_ID: '123456',
  VK_REDIRECT_URI: 'https://schemehappens.ru/api/auth/vk/callback',
  JWT_SECRET: 'test-jwt-secret',
};

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
    const url = new URL(provider.buildAuthUrl('state-1'));
    expect(url.origin + url.pathname).toBe('https://id.vk.com/authorize');
    const p = url.searchParams;
    expect(p.get('client_id')).toBe(CONFIG_MAP.VK_APP_ID);
    expect(p.get('redirect_uri')).toBe(CONFIG_MAP.VK_REDIRECT_URI);
    expect(p.get('response_type')).toBe('code');
    expect(p.get('state')).toBe('state-1');
    expect(p.get('code_challenge_method')).toBe('s256');
    expect(p.get('code_challenge')).toBeTruthy();
    expect(p.get('scope')).toBe('email phone');
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

// Инцидент 2026-10-03: verifier жил в Map одного процесса, а на Amvera
// больше одного инстанса — колбэк на соседнем инстансе (или после деплоя) не
// находил его, и вход через VK падал vk_failed. Теперь verifier выводится из
// state, и любой инстанс с тем же JWT_SECRET получает тот же самый.
describe('VkProvider — PKCE-verifier без состояния в памяти', () => {
  function verifierSent(fetchMock: jest.Mock): string | null {
    const [, init] = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith('/oauth2/auth'),
    ) as [string, { body: string }];
    return new URLSearchParams(init.body).get('code_verifier');
  }

  function challengeOf(verifier: string): string {
    return createHash('sha256').update(verifier).digest('base64url');
  }

  it('колбэк на ДРУГОМ инстансе шлёт verifier, совпадающий с challenge из authorize', async () => {
    const fetchMock = jest.fn((url: any) =>
      String(url).includes('user_info') ? userInfoOk() : tokenOk(),
    );
    global.fetch = fetchMock as any;
    const instanceA = new VkProvider(makeConfig());
    const instanceB = new VkProvider(makeConfig());

    const challenge = new URL(
      instanceA.buildAuthUrl('state-cross'),
    ).searchParams.get('code_challenge');
    const identity = await instanceB.exchangeCodeWithContext(
      'code',
      'device-1',
      'state-cross',
    );

    expect(identity.providerId).toBe('555666');
    const verifier = verifierSent(fetchMock);
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
    expect(challengeOf(verifier!)).toBe(challenge);
  });

  it('у разных state — разные challenge', () => {
    const provider = new VkProvider(makeConfig());
    const c1 = new URL(provider.buildAuthUrl('state-1')).searchParams.get(
      'code_challenge',
    );
    const c2 = new URL(provider.buildAuthUrl('state-2')).searchParams.get(
      'code_challenge',
    );
    expect(c1).not.toBe(c2);
  });

  it('verifier зависит от секрета: зная только state, его не вычислить', async () => {
    const fetchMock = jest.fn((url: any) =>
      String(url).includes('user_info') ? userInfoOk() : tokenOk(),
    );
    global.fetch = fetchMock as any;
    const challenge = new URL(
      new VkProvider(makeConfig()).buildAuthUrl('state-s'),
    ).searchParams.get('code_challenge');

    await new VkProvider(
      makeConfig({ JWT_SECRET: 'other-secret' }),
    ).exchangeCodeWithContext('code', 'device-1', 'state-s');
    expect(challengeOf(verifierSent(fetchMock)!)).not.toBe(challenge);
  });
});

describe('VkProvider.exchangeCodeWithContext — happy path и профиль', () => {
  it('успешный обмен: providerId/email из токена, displayName из user_info', async () => {
    global.fetch = jest.fn((url: any) =>
      String(url).includes('user_info')
        ? userInfoOk('Анна', 'Смирнова')
        : tokenOk(),
    ) as any;
    const provider = new VkProvider(makeConfig());
    provider.buildAuthUrl('state-happy');

    const identity = await provider.exchangeCodeWithContext(
      'code',
      'device-1',
      'state-happy',
    );
    expect(identity).toEqual({
      providerId: '555666',
      email: 'vk@example.com',
      displayName: 'Анна Смирнова',
    });
  });

  it('user_info вернул сеть-ошибку — не фатально: identity без displayName', async () => {
    global.fetch = jest.fn((url: any) => {
      if (String(url).includes('user_info')) throw new Error('network down');
      return tokenOk();
    }) as any;
    const provider = new VkProvider(makeConfig());
    provider.buildAuthUrl('state-userinfo-fail');

    const identity = await provider.exchangeCodeWithContext(
      'code',
      'device-1',
      'state-userinfo-fail',
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
    provider.buildAuthUrl('state-userinfo-500');

    const identity = await provider.exchangeCodeWithContext(
      'code',
      'device-1',
      'state-userinfo-500',
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
    provider.buildAuthUrl('state-err');

    await expect(
      provider.exchangeCodeWithContext('code', 'device-1', 'state-err'),
    ).rejects.toThrow('Authorization code expired');
  });

  it('нет access_token в ответе → UnauthorizedException', async () => {
    global.fetch = jest.fn(() => ({
      ok: true,
      json: () => ({ user_id: 1 }),
    })) as any;
    const provider = new VkProvider(makeConfig());
    provider.buildAuthUrl('state-no-token');

    await expect(
      provider.exchangeCodeWithContext('code', 'device-1', 'state-no-token'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('нет user_id в ответе → UnauthorizedException', async () => {
    global.fetch = jest.fn(() => ({
      ok: true,
      json: () => ({ access_token: 'tok' }),
    })) as any;
    const provider = new VkProvider(makeConfig());
    provider.buildAuthUrl('state-no-uid');

    await expect(
      provider.exchangeCodeWithContext('code', 'device-1', 'state-no-uid'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('сетевая ошибка на токен-эндпоинте пробрасывается наружу как есть (нет try/catch вокруг него)', async () => {
    global.fetch = jest.fn(() => {
      throw new Error('token endpoint unreachable');
    }) as any;
    const provider = new VkProvider(makeConfig());
    provider.buildAuthUrl('state-net-fail');

    await expect(
      provider.exchangeCodeWithContext('code', 'device-1', 'state-net-fail'),
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
    provider.buildAuthUrl('state-malformed');

    await expect(
      provider.exchangeCodeWithContext('code', 'device-1', 'state-malformed'),
    ).rejects.toThrow(SyntaxError);
  });
});
