// TEST_COVERAGE_PLAN.md, этап 1 п.6 (остаток): TelegramOidcProvider — новый
// OIDC-флоу входа через Telegram (PKCE, без client_secret). Регрессия здесь
// либо ломает вход всем Telegram-юзерам на сайте, либо (при ошибке в PKCE/
// endpoint-логике) открывает путь для подмены identity. fetch мокается по
// паттерну robokassa.service.spec.ts.
import { createHash } from 'crypto';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramOidcProvider } from './telegram-oidc.provider';

const CONFIG_MAP: Record<string, string> = {
  BOT_TOKEN: '111222333:AAExampleTestTokenNotReal',
  WEBAPP_URL: 'https://schemehappens.ru/',
};

function makeProvider(
  overrides: Record<string, string> = {},
): TelegramOidcProvider {
  const map = { ...CONFIG_MAP, ...overrides };
  const config = {
    getOrThrow: (key: string) => {
      if (!(key in map)) throw new Error(`missing config key: ${key}`);
      return map[key];
    },
  } as unknown as ConfigService;
  return new TelegramOidcProvider(config);
}

function tokenOk(accessToken = 'access-token-1') {
  return { ok: true, json: () => ({ access_token: accessToken }) };
}

function userinfoOk(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    json: () => ({ sub: 'tg-42', ...overrides }),
  };
}

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

describe('TelegramOidcProvider.generatePkce', () => {
  it('challenge = base64url(sha256(verifier)), verifier base64url без паддинга', () => {
    const provider = makeProvider();
    const { verifier, challenge } = provider.generatePkce();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(challenge).toBe(expected);
  });

  it('каждый вызов даёт новый уникальный verifier', () => {
    const provider = makeProvider();
    const a = provider.generatePkce();
    const b = provider.generatePkce();
    expect(a.verifier).not.toBe(b.verifier);
  });
});

describe('TelegramOidcProvider.buildAuthUrl', () => {
  it('строит authorize-URL с client_id=botId, redirect_uri, origin и code_challenge', () => {
    const provider = makeProvider();
    const url = new URL(provider.buildAuthUrl('state-1', 'challenge-abc'));
    expect(url.origin + url.pathname).toBe('https://oauth.telegram.org/auth');
    const p = url.searchParams;
    expect(p.get('client_id')).toBe('111222333'); // botId — часть до ':' в BOT_TOKEN
    expect(p.get('redirect_uri')).toBe(
      'https://schemehappens.ru/api/auth/telegram-oidc/callback',
    );
    expect(p.get('response_type')).toBe('code');
    expect(p.get('scope')).toBe('openid profile');
    expect(p.get('state')).toBe('state-1');
    expect(p.get('origin')).toBe('https://schemehappens.ru');
    expect(p.get('code_challenge')).toBe('challenge-abc');
    expect(p.get('code_challenge_method')).toBe('S256');
  });

  it('codeChallenge не передан → пустая строка в query (не "undefined")', () => {
    const provider = makeProvider();
    const url = new URL(provider.buildAuthUrl('state-2'));
    expect(url.searchParams.get('code_challenge')).toBe('');
  });

  it('WEBAPP_URL с завершающим слэшем нормализуется в redirect_uri (без двойного слэша)', () => {
    const provider = makeProvider({ WEBAPP_URL: 'https://schemehappens.ru/' });
    const url = new URL(provider.buildAuthUrl('state-3'));
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://schemehappens.ru/api/auth/telegram-oidc/callback',
    );
  });
});

describe('TelegramOidcProvider.exchangeCodePkce — happy path и displayName fallback', () => {
  it('полный профиль: name присутствует → используется как displayName', async () => {
    global.fetch = jest.fn((url: any) =>
      String(url).includes('userinfo')
        ? userinfoOk({
            name: 'Аня Иванова',
            given_name: 'Аня',
            username: 'anna',
          })
        : tokenOk(),
    ) as any;
    const provider = makeProvider();
    const identity = await provider.exchangeCodePkce('code', 'verifier');
    expect(identity).toEqual({
      providerId: 'tg-42',
      displayName: 'Аня Иванова',
    });
  });

  it('нет name, но есть given_name+family_name → склеенное имя', async () => {
    global.fetch = jest.fn((url: any) =>
      String(url).includes('userinfo')
        ? userinfoOk({
            given_name: 'Пётр',
            family_name: 'Иванов',
            username: 'petya',
          })
        : tokenOk(),
    ) as any;
    const provider = makeProvider();
    const identity = await provider.exchangeCodePkce('code', 'verifier');
    expect(identity.displayName).toBe('Пётр Иванов');
  });

  it('нет name/given_name/family_name, но есть username → используется username', async () => {
    global.fetch = jest.fn((url: any) =>
      String(url).includes('userinfo')
        ? userinfoOk({ username: 'petya' })
        : tokenOk(),
    ) as any;
    const provider = makeProvider();
    const identity = await provider.exchangeCodePkce('code', 'verifier');
    expect(identity.displayName).toBe('petya');
  });

  it('нет вообще никаких имён → displayName = "tg_<sub>"', async () => {
    global.fetch = jest.fn((url: any) =>
      String(url).includes('userinfo') ? userinfoOk({}) : tokenOk(),
    ) as any;
    const provider = makeProvider();
    const identity = await provider.exchangeCodePkce('code', 'verifier');
    expect(identity).toEqual({ providerId: 'tg-42', displayName: 'tg_tg-42' });
  });

  it('email в ProviderIdentity не выставляется (Telegram OIDC его не отдаёт)', async () => {
    global.fetch = jest.fn((url: any) =>
      String(url).includes('userinfo')
        ? userinfoOk({ username: 'petya' })
        : tokenOk(),
    ) as any;
    const provider = makeProvider();
    const identity = await provider.exchangeCodePkce('code', 'verifier');
    expect(identity.email).toBeUndefined();
  });
});

describe('TelegramOidcProvider.exchangeCodePkce — ошибки на этапе token exchange', () => {
  it('сетевая ошибка при обмене кода → UnauthorizedException("...network error")', async () => {
    global.fetch = jest.fn(() => {
      throw new Error('dns lookup failed');
    }) as any;
    const provider = makeProvider();
    await expect(provider.exchangeCodePkce('code', 'verifier')).rejects.toThrow(
      'Telegram OIDC token exchange network error',
    );
  });

  it('token-эндпоинт вернул не-2xx → UnauthorizedException("...token exchange failed")', async () => {
    global.fetch = jest.fn(() => ({
      ok: false,
      status: 400,
      text: () => Promise.resolve('invalid_grant'),
    })) as any;
    const provider = makeProvider();
    await expect(provider.exchangeCodePkce('code', 'verifier')).rejects.toThrow(
      'Telegram OIDC token exchange failed',
    );
  });
});

describe('TelegramOidcProvider.exchangeCodePkce — ошибки на этапе userinfo', () => {
  it('сетевая ошибка при запросе userinfo → UnauthorizedException("...userinfo network error")', async () => {
    global.fetch = jest.fn((url: any) => {
      if (String(url).includes('userinfo')) throw new Error('connection reset');
      return tokenOk();
    }) as any;
    const provider = makeProvider();
    await expect(provider.exchangeCodePkce('code', 'verifier')).rejects.toThrow(
      'Telegram OIDC userinfo network error',
    );
  });

  it('userinfo вернул не-2xx → UnauthorizedException("...userinfo failed")', async () => {
    global.fetch = jest.fn((url: any) => {
      if (String(url).includes('userinfo'))
        return {
          ok: false,
          status: 401,
          text: () => Promise.resolve('invalid_token'),
        };
      return tokenOk();
    }) as any;
    const provider = makeProvider();
    await expect(provider.exchangeCodePkce('code', 'verifier')).rejects.toThrow(
      'Telegram OIDC userinfo failed',
    );
  });

  it('все ошибки — UnauthorizedException (а не произвольный тип)', async () => {
    global.fetch = jest.fn(() => ({
      ok: false,
      status: 500,
      text: () => Promise.resolve(''),
    })) as any;
    const provider = makeProvider();
    await expect(
      provider.exchangeCodePkce('code', 'verifier'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
