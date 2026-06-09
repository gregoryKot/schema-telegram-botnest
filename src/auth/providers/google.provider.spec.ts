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
      GOOGLE_REDIRECT_URI: 'https://schemalab.ru/cb',
    }[k])),
  } as any;
  return new GoogleProvider(config);
}

describe('GoogleProvider.buildAuthUrl', () => {
  it('строит URL Google с id_token/form_post', () => {
    const url = makeProvider().buildAuthUrl('state-xyz', 'nonce-abc');
    expect(url).toContain('accounts.google.com/o/oauth2/v2/auth');
    expect(url).toContain('client_id=client-123');
    expect(url).toContain('response_type=id_token');
    expect(url).toContain('state=state-xyz');
    expect(url).toContain('nonce=nonce-abc');
  });
});

describe('GoogleProvider.verifyIdToken', () => {
  beforeEach(() => mockJwtVerify.mockReset());

  it('валидный токен → ProviderIdentity', async () => {
    mockJwtVerify.mockResolvedValue({
      payload: { sub: 'g-1', email: 'a@b.com', name: 'Аня', nonce: 'N', email_verified: true },
    });
    expect(await makeProvider().verifyIdToken('tok', 'N')).toEqual({
      providerId: 'g-1', email: 'a@b.com', displayName: 'Аня',
    });
  });

  it('падение jwtVerify (плохая подпись/aud/iss) → 401', async () => {
    mockJwtVerify.mockRejectedValue(new Error('bad signature'));
    await expect(makeProvider().verifyIdToken('tok', 'N')).rejects.toThrow('Google ID token invalid');
  });

  it('несовпадение nonce → 401', async () => {
    mockJwtVerify.mockResolvedValue({ payload: { sub: 'g', email: 'a@b', nonce: 'WRONG', email_verified: true } });
    await expect(makeProvider().verifyIdToken('tok', 'EXPECTED')).rejects.toThrow('nonce mismatch');
  });

  it('email не подтверждён → 401', async () => {
    mockJwtVerify.mockResolvedValue({ payload: { sub: 'g', email: 'a@b', nonce: 'N', email_verified: false } });
    await expect(makeProvider().verifyIdToken('tok', 'N')).rejects.toThrow('email not verified');
  });

  it('displayName падает на email, если name отсутствует', async () => {
    mockJwtVerify.mockResolvedValue({ payload: { sub: 'g', email: 'a@b.com', nonce: 'N', email_verified: true } });
    expect((await makeProvider().verifyIdToken('tok', 'N')).displayName).toBe('a@b.com');
  });
});
