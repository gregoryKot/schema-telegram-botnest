import { createHash } from 'crypto';
import { TelegramOidcProvider } from './telegram-oidc.provider';

function makeProvider() {
  const config = {
    getOrThrow: jest.fn((k: string) => ({
      BOT_TOKEN: '12345:secret',
      WEBAPP_URL: 'https://schemalab.ru/',
    }[k])),
  } as any;
  return new TelegramOidcProvider(config);
}

function fetchOk(json: unknown) {
  return { ok: true, json: async () => json } as any;
}
function fetchFail(status: number) {
  return { ok: false, status, text: async () => 'err body' } as any;
}

describe('TelegramOidcProvider.generatePkce', () => {
  it('challenge = base64url(sha256(verifier))', () => {
    const { verifier, challenge } = makeProvider().generatePkce();
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(challenge).toBe(expected);
  });
});

describe('TelegramOidcProvider.buildAuthUrl', () => {
  it('содержит botId как client_id и oauth.telegram.org', () => {
    const url = makeProvider().buildAuthUrl('st', 'challenge-x');
    expect(url).toContain('oauth.telegram.org/auth');
    expect(url).toContain('client_id=12345'); // botId = до ":" из BOT_TOKEN
    expect(url).toContain('code_challenge=challenge-x');
  });
});

describe('TelegramOidcProvider.exchangeCodePkce', () => {
  afterEach(() => { (global.fetch as any) = undefined; });

  it('успех → ProviderIdentity', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce(fetchOk({ access_token: 'a' }))
      .mockResolvedValueOnce(fetchOk({ sub: '77', name: 'Имя' })) as any;
    expect(await makeProvider().exchangeCodePkce('code', 'verifier'))
      .toEqual({ providerId: '77', displayName: 'Имя' });
  });

  it('сетевая ошибка на token → 401 network error', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('ECONNREFUSED')) as any;
    await expect(makeProvider().exchangeCodePkce('code', 'v'))
      .rejects.toThrow('token exchange network error');
  });

  it('token-эндпоинт вернул не-2xx → 401 token exchange failed', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(fetchFail(400)) as any;
    await expect(makeProvider().exchangeCodePkce('code', 'v'))
      .rejects.toThrow('token exchange failed');
  });

  it('userinfo вернул не-2xx → 401 userinfo failed', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce(fetchOk({ access_token: 'a' }))
      .mockResolvedValueOnce(fetchFail(403)) as any;
    await expect(makeProvider().exchangeCodePkce('code', 'v'))
      .rejects.toThrow('userinfo failed');
  });

  it('сетевая ошибка на userinfo → 401 userinfo network error', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce(fetchOk({ access_token: 'a' }))
      .mockRejectedValueOnce(new Error('ETIMEDOUT')) as any;
    await expect(makeProvider().exchangeCodePkce('code', 'v'))
      .rejects.toThrow('userinfo network error');
  });

  it('displayName: fallback на given+family, затем username, затем tg_sub', async () => {
    // given+family
    global.fetch = jest.fn()
      .mockResolvedValueOnce(fetchOk({ access_token: 'a' }))
      .mockResolvedValueOnce(fetchOk({ sub: '1', given_name: 'Иван', family_name: 'Петров' })) as any;
    expect((await makeProvider().exchangeCodePkce('c', 'v')).displayName).toBe('Иван Петров');

    // username
    global.fetch = jest.fn()
      .mockResolvedValueOnce(fetchOk({ access_token: 'a' }))
      .mockResolvedValueOnce(fetchOk({ sub: '2', username: 'ivan' })) as any;
    expect((await makeProvider().exchangeCodePkce('c', 'v')).displayName).toBe('ivan');

    // tg_sub
    global.fetch = jest.fn()
      .mockResolvedValueOnce(fetchOk({ access_token: 'a' }))
      .mockResolvedValueOnce(fetchOk({ sub: '3' })) as any;
    expect((await makeProvider().exchangeCodePkce('c', 'v')).displayName).toBe('tg_3');
  });
});
