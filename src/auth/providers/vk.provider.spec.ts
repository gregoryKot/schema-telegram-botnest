import { VkProvider } from './vk.provider';

function makeProvider() {
  const config = {
    getOrThrow: jest.fn((k: string) => ({
      VK_APP_ID: 'vk-app',
      VK_REDIRECT_URI: 'https://schemalab.ru/vk/cb',
    }[k])),
  } as any;
  return new VkProvider(config);
}

function fetchOk(json: unknown) {
  return { ok: true, json: async () => json } as any;
}

describe('VkProvider.buildAuthUrl', () => {
  it('строит PKCE-URL id.vk.com с code_challenge', () => {
    const url = makeProvider().buildAuthUrl('st-1');
    expect(url).toContain('id.vk.com/authorize');
    expect(url).toContain('client_id=vk-app');
    expect(url).toContain('code_challenge=');
    expect(url).toContain('code_challenge_method=s256');
  });
});

describe('VkProvider.exchangeCode', () => {
  it('бросает — VK требует контекст (device_id/state)', async () => {
    await expect(makeProvider().exchangeCode('code')).rejects.toThrow('requires context');
  });
});

describe('VkProvider.exchangeCodeWithContext', () => {
  afterEach(() => { (global.fetch as any) = undefined; });

  it('нет PKCE-verifier для state → 401', async () => {
    const provider = makeProvider(); // buildAuthUrl не вызывали → map пуст
    await expect(provider.exchangeCodeWithContext('code', 'dev', 'unknown-state'))
      .rejects.toThrow('PKCE verifier expired or missing');
  });

  it('успешный обмен → ProviderIdentity с именем из user_info', async () => {
    const provider = makeProvider();
    provider.buildAuthUrl('st-ok'); // кладёт verifier для state
    global.fetch = jest.fn()
      .mockResolvedValueOnce(fetchOk({ access_token: 'tok', user_id: 42, email: 'e@vk' }))
      .mockResolvedValueOnce(fetchOk({ user: { first_name: 'Иван', last_name: 'П' } })) as any;

    const identity = await provider.exchangeCodeWithContext('code', 'dev', 'st-ok');
    expect(identity).toEqual({ providerId: '42', email: 'e@vk', displayName: 'Иван П' });
  });

  it('сбой user_info не фатален — identity возвращается без displayName', async () => {
    const provider = makeProvider();
    provider.buildAuthUrl('st-nofatal');
    global.fetch = jest.fn()
      .mockResolvedValueOnce(fetchOk({ access_token: 'tok', user_id: 9, email: 'e@vk' }))
      .mockRejectedValueOnce(new Error('user_info down')) as any;
    const identity = await provider.exchangeCodeWithContext('code', 'dev', 'st-nofatal');
    expect(identity).toEqual({ providerId: '9', email: 'e@vk', displayName: undefined });
  });

  it('ошибка токен-обмена VK → 401', async () => {
    const provider = makeProvider();
    provider.buildAuthUrl('st-err');
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false, json: async () => ({ error: 'invalid_grant', error_description: 'bad code' }),
    }) as any;
    await expect(provider.exchangeCodeWithContext('code', 'dev', 'st-err'))
      .rejects.toThrow('VK auth error: bad code');
  });

  it('verifier одноразовый — повторный обмен по тому же state → 401', async () => {
    const provider = makeProvider();
    provider.buildAuthUrl('st-once');
    global.fetch = jest.fn()
      .mockResolvedValueOnce(fetchOk({ access_token: 'tok', user_id: 1 }))
      .mockResolvedValueOnce(fetchOk({ user: {} })) as any;
    await provider.exchangeCodeWithContext('code', 'dev', 'st-once');
    await expect(provider.exchangeCodeWithContext('code', 'dev', 'st-once'))
      .rejects.toThrow('PKCE verifier expired or missing');
  });
});
