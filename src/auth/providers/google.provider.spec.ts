// TEST_COVERAGE_PLAN.md, этап 1 п.6 (остаток): GoogleProvider — единственная
// проверка подписи id_token от Google. Регрессия тут либо пускает чужой
// токен (подделанный aud/iss), либо ломает вход всем Google-юзерам.
//
// 'jose' — чистый ESM-пакет, ts-jest не умеет его парсить напрямую (см.
// комментарий в telegram.provider.spec.ts про registry.ts). Здесь мы тестируем
// САМ google.provider.ts, поэтому вместо jest.mock('./google.provider', ...)
// мокаем ниже уровнем — сам модуль 'jose': createRemoteJWKSet/jwtVerify
// становятся управляемыми фейками, без реального сетевого JWKS-клиента.
jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn(() => 'FAKE_JWKS_SET'),
  jwtVerify: jest.fn(),
  // Настоящий разбор payload — офлайн-ветка (JWKS недостижим) обязана
  // проверяться против реального токена, а не против заглушки.
  decodeJwt: (token: string): unknown =>
    JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString('utf8'),
    ) as unknown,
}));

import { Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { jwtVerify } from 'jose';
import { GoogleProvider } from './google.provider';

const mockedJwtVerify = jwtVerify as jest.Mock;

const CONFIG_MAP: Record<string, string> = {
  GOOGLE_CLIENT_ID: 'client-123.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'super-secret',
  GOOGLE_REDIRECT_URI: 'https://schemehappens.ru/api/auth/google/callback',
};

function makeProvider(overrides: Record<string, string> = {}): GoogleProvider {
  const map = { ...CONFIG_MAP, ...overrides };
  const config = {
    getOrThrow: (key: string) => {
      if (!(key in map)) throw new Error(`missing config key: ${key}`);
      return map[key];
    },
  } as unknown as ConfigService;
  return new GoogleProvider(config);
}

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
  jest.clearAllMocks();
});

describe('GoogleProvider.buildAuthUrl', () => {
  it('строит authorize-URL с client_id/redirect_uri/state и code-флоу', () => {
    const provider = makeProvider();
    const url = new URL(provider.buildAuthUrl('state-xyz'));
    expect(url.origin + url.pathname).toBe(
      'https://accounts.google.com/o/oauth2/v2/auth',
    );
    const p = url.searchParams;
    expect(p.get('client_id')).toBe(CONFIG_MAP.GOOGLE_CLIENT_ID);
    expect(p.get('redirect_uri')).toBe(CONFIG_MAP.GOOGLE_REDIRECT_URI);
    expect(p.get('response_type')).toBe('code');
    expect(p.get('scope')).toBe('openid email profile');
    expect(p.get('state')).toBe('state-xyz');
    expect(p.get('access_type')).toBe('online');
  });

  it('callbackOrigin() = origin GOOGLE_REDIRECT_URI (2026-09-08: кука oauth_state обязана жить на этом хосте)', () => {
    const provider = makeProvider();
    expect(provider.callbackOrigin()).toBe('https://schemehappens.ru');
  });

  it('ВХОД (forceChooser не задан): prompt НЕ ставится — вошедшего впускаем одним касанием', () => {
    // Разбор 2026-08-31: хардкод prompt=select_account заставлял выбирать
    // аккаунт заново на каждый вход — «авторизация с нуля». Без prompt Google
    // сам вернёт уже вошедшего («Continue as X»).
    const provider = makeProvider();
    const p = new URL(provider.buildAuthUrl('state-login')).searchParams;
    expect(p.get('prompt')).toBeNull();
  });

  it('ПРИВЯЗКА (forceChooser=true): prompt=select_account — выбор аккаунта принудительно', () => {
    // При привязке второго аккаунта выбор оставляем явным, чтобы человек не
    // прицепил случайно уже открытый в браузере Google вместо нужного.
    const provider = makeProvider();
    const p = new URL(provider.buildAuthUrl('state-link', undefined, true))
      .searchParams;
    expect(p.get('prompt')).toBe('select_account');
  });
});

describe('GoogleProvider.exchangeCode — happy path и payload → profile', () => {
  it('успешный обмен: id_token верифицирован → providerId/email/displayName из payload', async () => {
    global.fetch = jest.fn(() => ({
      ok: true,
      json: () => Promise.resolve({ id_token: 'fake.id.token' }),
    })) as any;
    mockedJwtVerify.mockResolvedValue({
      payload: {
        sub: 'google-user-1',
        email: 'anna@example.com',
        email_verified: true,
        name: 'Аня Петрова',
        given_name: 'Аня',
      },
    });

    const provider = makeProvider();
    const identity = await provider.exchangeCode('auth-code');
    // S16 (аудит 2026-11): displayName ляжет открытым в User.firstName —
    // только имя (given_name), фамилия из `name` туда не попадает.
    expect(identity).toEqual({
      providerId: 'google-user-1',
      email: 'anna@example.com',
      displayName: 'Аня',
    });
  });

  it('S16: нет given_name (есть только полное name) → displayName пуст, а не полное имя', async () => {
    global.fetch = jest.fn(() => ({
      ok: true,
      json: () => Promise.resolve({ id_token: 'fake.id.token' }),
    })) as any;
    mockedJwtVerify.mockResolvedValue({
      payload: {
        sub: 'google-user-3',
        email: 'ivan@example.com',
        email_verified: true,
        name: 'Иван Петров',
      },
    });

    const identity = await makeProvider().exchangeCode('auth-code');
    expect(identity.displayName).toBeUndefined();
  });

  it('S16: нет имени в payload → displayName пуст, почта в него не попадает (раньше падал на email)', async () => {
    global.fetch = jest.fn(() => ({
      ok: true,
      json: () => Promise.resolve({ id_token: 'fake.id.token' }),
    })) as any;
    mockedJwtVerify.mockResolvedValue({
      payload: {
        sub: 'google-user-2',
        email: 'noNAme@example.com',
        email_verified: true,
      },
    });

    const provider = makeProvider();
    const identity = await provider.exchangeCode('auth-code');
    expect(identity.displayName).toBeUndefined();
    expect(identity.email).toBe('noNAme@example.com');
  });

  it('email_verified !== true → UnauthorizedException("Google email not verified")', async () => {
    global.fetch = jest.fn(() => ({
      ok: true,
      json: () => Promise.resolve({ id_token: 'fake.id.token' }),
    })) as any;
    mockedJwtVerify.mockResolvedValue({
      payload: {
        sub: 'google-user-3',
        email: 'unverified@example.com',
        email_verified: false,
      },
    });

    const provider = makeProvider();
    await expect(provider.exchangeCode('auth-code')).rejects.toThrow(
      'Google email not verified',
    );
  });

  it('jwtVerify бросает (просроченный/подделанный токен) → UnauthorizedException("Google ID token invalid")', async () => {
    global.fetch = jest.fn(() => ({
      ok: true,
      json: () => Promise.resolve({ id_token: 'fake.id.token' }),
    })) as any;
    mockedJwtVerify.mockRejectedValue(
      new Error('"exp" claim timestamp check failed'),
    );

    const provider = makeProvider();
    await expect(provider.exchangeCode('auth-code')).rejects.toThrow(
      'Google ID token invalid',
    );
  });
});

describe('GoogleProvider.exchangeCode — ключи Google недоступны с хоста', () => {
  // Инцидент 2026-08-04: googleapis.com перестал резолвиться с хостинга, обмен
  // кода проходил (у него свой fallback), а JWKS — нет, и вход ломался всем.
  function idToken(payload: Record<string, unknown>): string {
    const body = Buffer.from(JSON.stringify(payload), 'utf8').toString(
      'base64url',
    );
    return `header.${body}.signature`;
  }

  it('JWKS не скачался → identity всё равно выдана (токен получен от Google по TLS)', async () => {
    const token = idToken({
      iss: 'https://accounts.google.com',
      aud: CONFIG_MAP.GOOGLE_CLIENT_ID,
      sub: 'google-user-offline',
      email: 'offline@example.com',
      email_verified: true,
      given_name: 'Офлайн',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    global.fetch = jest.fn(() => ({
      ok: true,
      json: () => Promise.resolve({ id_token: token }),
    })) as any;
    mockedJwtVerify.mockRejectedValue(new TypeError('fetch failed'));

    const provider = makeProvider();
    await expect(provider.exchangeCode('auth-code')).resolves.toEqual({
      providerId: 'google-user-offline',
      email: 'offline@example.com',
      displayName: 'Офлайн',
    });
  });

  it('JWKS не скачался, но токен выписан другому приложению → отказ', async () => {
    const token = idToken({
      iss: 'https://accounts.google.com',
      aud: 'someone-else.apps.googleusercontent.com',
      sub: 'attacker',
      email_verified: true,
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    global.fetch = jest.fn(() => ({
      ok: true,
      json: () => Promise.resolve({ id_token: token }),
    })) as any;
    mockedJwtVerify.mockRejectedValue(new TypeError('fetch failed'));

    const provider = makeProvider();
    await expect(provider.exchangeCode('auth-code')).rejects.toThrow(
      'Google ID token invalid',
    );
  });
});

describe('GoogleProvider.exchangeCode — обмен кода на токен: ошибки и fallback', () => {
  it('первый token-эндпоинт недоступен по сети → пробует следующий алиас и всё равно выдаёт identity', async () => {
    let attempt = 0;
    global.fetch = jest.fn(() => {
      attempt++;
      if (attempt === 1) throw new Error('fetch failed');
      return {
        ok: true,
        json: () => Promise.resolve({ id_token: 'fake.id.token' }),
      };
    }) as any;
    mockedJwtVerify.mockResolvedValue({
      payload: {
        sub: 'google-user-4',
        email: 'fallback@example.com',
        email_verified: true,
        name: 'Fallback User',
      },
    });

    const provider = makeProvider();
    const identity = await provider.exchangeCode('auth-code');
    expect(identity.providerId).toBe('google-user-4');
  });

  it('все token-эндпоинты недоступны по сети → UnauthorizedException', async () => {
    global.fetch = jest.fn(() => {
      throw new Error('network down');
    }) as any;

    const provider = makeProvider();
    await expect(provider.exchangeCode('auth-code')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('Google вернул HTTP-ошибку (error в JSON) → UnauthorizedException, без ретрая на другие эндпоинты', async () => {
    global.fetch = jest.fn(() => ({
      ok: false,
      status: 400,
      json: () =>
        Promise.resolve({
          error: 'invalid_grant',
          error_description: 'Malformed auth code',
        }),
    })) as any;

    const provider = makeProvider();
    await expect(provider.exchangeCode('bad-code')).rejects.toThrow(
      'Google token exchange failed',
    );
  });

  // S13 (аудит 2026-11): колбэк открыт без входа — выдуманный или повторный
  // код (invalid_grant) не должен уходить владельцу в DM; поломка настройки
  // (invalid_client, redirect_uri_mismatch) — должна.
  it.each([
    ['invalid_grant', 'warn'],
    ['invalid_client', 'error'],
    ['redirect_uri_mismatch', 'error'],
  ])('отказ Google %s → уровень %s', async (code, level) => {
    global.fetch = jest.fn(() => ({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: code }),
    })) as any;
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    try {
      await expect(makeProvider().exchangeCode('c')).rejects.toThrow(
        UnauthorizedException,
      );
      const used = level === 'warn' ? warn : error;
      const other = level === 'warn' ? error : warn;
      expect(used).toHaveBeenCalledWith(
        expect.stringContaining('Google token exchange rejected'),
      );
      expect(other).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
      error.mockRestore();
    }
  });

  it('ответ 200 без id_token → UnauthorizedException', async () => {
    global.fetch = jest.fn(() => ({
      ok: true,
      json: () => Promise.resolve({}),
    })) as any;

    const provider = makeProvider();
    await expect(provider.exchangeCode('auth-code')).rejects.toThrow(
      'Google token exchange failed',
    );
  });

  it('невалидный JSON в ответе (res.json() падает) не крашит процесс — трактуется как ответ без id_token', async () => {
    global.fetch = jest.fn(() => ({
      ok: true,
      json: () => Promise.reject(new SyntaxError('Unexpected token')),
    })) as any;

    const provider = makeProvider();
    await expect(provider.exchangeCode('auth-code')).rejects.toThrow(
      'Google token exchange failed',
    );
  });
});
