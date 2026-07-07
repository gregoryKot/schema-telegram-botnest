import { jwtVerify } from 'jose';
import { GoogleProvider } from './google.provider';

jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn(() => 'JWKS'),
  jwtVerify: jest.fn(),
}));
const mockJwtVerify = jwtVerify as jest.Mock;

function makeProvider() {
  const config = {
    getOrThrow: jest.fn((k: string) => ({
      GOOGLE_CLIENT_ID: 'client-123',
      GOOGLE_CLIENT_SECRET: 'secret-x',
      GOOGLE_REDIRECT_URI: 'https://schemehappens.ru/cb',
    }[k])),
  } as any;
  return new GoogleProvider(config);
}

const tokenOk = (idToken = 'id-jwt') => ({ ok: true, json: async () => ({ id_token: idToken }) });
const goodPayload = { sub: 'g-1', email: 'a@b.com', name: 'Аня', email_verified: true };

describe('GoogleProvider.buildAuthUrl', () => {
  it('строит authorization-code URL (не легаси id_token flow)', () => {
    const url = makeProvider().buildAuthUrl('state-xyz');
    expect(url).toContain('accounts.google.com/o/oauth2/v2/auth');
    expect(url).toContain('client_id=client-123');
    expect(url).toContain('response_type=code');
    expect(url).toContain('state=state-xyz');
    expect(url).toContain('prompt=select_account');
  });
});

describe('GoogleProvider.exchangeCode', () => {
  beforeEach(() => {
    mockJwtVerify.mockReset();
    mockJwtVerify.mockResolvedValue({ payload: goodPayload });
  });
  afterEach(() => { (global.fetch as any) = undefined; });

  it('успех: обмен кода → верификация id_token → ProviderIdentity', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(tokenOk()) as any;
    expect(await makeProvider().exchangeCode('code-1')).toEqual({
      providerId: 'g-1', email: 'a@b.com', displayName: 'Аня',
    });
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('oauth2.googleapis.com/token');
    expect(init.body).toContain('grant_type=authorization_code');
    expect(init.body).toContain('code=code-1');
  });

  it('HTTP-отказ Google (error в теле) → 401 БЕЗ fallback на другие алиасы', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false, status: 400, json: async () => ({ error: 'invalid_grant', error_description: 'bad code' }),
    }) as any;
    await expect(makeProvider().exchangeCode('bad')).rejects.toThrow('Google token exchange failed');
    expect(global.fetch).toHaveBeenCalledTimes(1); // вердикт получен — алиасы не пробуем
  });

  it('сетевой сбой первого endpoint → fallback на следующий алиас → успех', async () => {
    global.fetch = jest.fn()
      .mockRejectedValueOnce(new Error('fetch failed'))
      .mockResolvedValueOnce(tokenOk()) as any;
    expect((await makeProvider().exchangeCode('c')).providerId).toBe('g-1');
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect((global.fetch as jest.Mock).mock.calls[1][0]).toContain('www.googleapis.com/oauth2/v4/token');
  });

  it('все endpoints сетево недоступны → 401', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ENETUNREACH')) as any;
    await expect(makeProvider().exchangeCode('c')).rejects.toThrow('Google token exchange failed');
    expect(global.fetch).toHaveBeenCalledTimes(3); // все три алиаса испробованы
  });

  it('битая подпись id_token (jwtVerify кидает) → 401 Google ID token invalid', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(tokenOk()) as any;
    mockJwtVerify.mockRejectedValue(new Error('bad signature'));
    await expect(makeProvider().exchangeCode('c')).rejects.toThrow('Google ID token invalid');
  });

  it('email не подтверждён → 401', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(tokenOk()) as any;
    mockJwtVerify.mockResolvedValue({ payload: { ...goodPayload, email_verified: false } });
    await expect(makeProvider().exchangeCode('c')).rejects.toThrow('email not verified');
  });

  it('displayName падает на email, если name отсутствует', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(tokenOk()) as any;
    mockJwtVerify.mockResolvedValue({ payload: { sub: 'g', email: 'a@b.com', email_verified: true } });
    expect((await makeProvider().exchangeCode('c')).displayName).toBe('a@b.com');
  });
});
