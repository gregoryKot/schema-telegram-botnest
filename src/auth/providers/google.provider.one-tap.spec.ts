// One Tap: id_token присылает БРАУЗЕР, поэтому GoogleProvider.verifyIdToken с
// опцией oneTap требует nonce из куки и запрещает офлайн-ветку (B-16 аудита
// 2026-10). Без опции (обмен кода) поведение прежнее — контрольный случай.
jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn(() => 'FAKE_JWKS_SET'),
  jwtVerify: jest.fn(),
  decodeJwt: (token: string): unknown =>
    JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString('utf8'),
    ) as unknown,
}));

import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { jwtVerify } from 'jose';
import { GoogleProvider } from './google.provider';
import { resetGoogleJwks } from './google-id-token';

const mockedJwtVerify = jwtVerify as jest.Mock;
const CLIENT_ID = 'client-123.apps.googleusercontent.com';
const SECRET = 'cookie-secret';
const NONCE = createHash('sha256').update(SECRET).digest('hex');

const provider = new GoogleProvider({
  getOrThrow: (k: string) => (k === 'GOOGLE_CLIENT_ID' ? CLIENT_ID : 'x'),
} as unknown as ConfigService);

function claims(extra: Record<string, unknown> = {}) {
  return {
    sub: 'g-1',
    email: 'a@example.com',
    email_verified: true,
    name: 'Аня',
    ...extra,
  };
}

beforeEach(() => {
  mockedJwtVerify.mockReset();
  resetGoogleJwks();
});

describe('GoogleProvider.verifyIdToken — One Tap nonce', () => {
  it('nonce в токене = sha256(кука) → вход проходит', async () => {
    mockedJwtVerify.mockResolvedValue({ payload: claims({ nonce: NONCE }) });
    await expect(
      provider.verifyIdToken('h.p.s', { nonceCookie: SECRET }),
    ).resolves.toMatchObject({ providerId: 'g-1' });
  });

  it.each([
    ['нет куки', undefined, NONCE],
    ['нет claim nonce', SECRET, undefined],
    ['nonce чужой (токен выдан для другого браузера)', SECRET, 'f'.repeat(64)],
    ['nonce другой длины', SECRET, 'abc'],
  ])('%s → Unauthorized', async (_n, cookie, nonce) => {
    mockedJwtVerify.mockResolvedValue({
      payload: claims(nonce ? { nonce } : {}),
    });
    await expect(
      provider.verifyIdToken('h.p.s', { nonceCookie: cookie }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('JWKS недоступен (офлайн-ветка) → One Tap отклоняется, даже если nonce совпал', async () => {
    mockedJwtVerify.mockRejectedValue(new Error('fetch failed'));
    const now = Math.floor(Date.now() / 1000);
    const payload = claims({
      nonce: NONCE,
      iss: 'https://accounts.google.com',
      aud: CLIENT_ID,
      exp: now + 600,
      iat: now,
    });
    const jwt = `h.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.s`;
    await expect(
      provider.verifyIdToken(jwt, { nonceCookie: SECRET }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    // Контрольный: тот же токен БЕЗ oneTap (обмен кода по TLS) по-прежнему принимается.
    await expect(provider.verifyIdToken(jwt)).resolves.toMatchObject({
      providerId: 'g-1',
    });
  });

  it('без опции oneTap nonce не требуется (обмен кода не затронут)', async () => {
    mockedJwtVerify.mockResolvedValue({ payload: claims() });
    await expect(provider.verifyIdToken('h.p.s')).resolves.toMatchObject({
      providerId: 'g-1',
    });
  });
});
