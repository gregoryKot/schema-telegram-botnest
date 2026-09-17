// Регрессия на инцидент 2026-08-04: с хостинга перестал резолвиться
// googleapis.com, JWKS не скачивался, и вход через Google падал у всех
// («Google id_token JWT verification failed: fetch failed»).
//
// Самое важное здесь — граница смягчения. Офлайн-ветка обязана включаться
// ТОЛЬКО на сетевом сбое: если сеть жива, а подпись/aud/iss/exp плохие, токен
// по-прежнему отвергается. Тест, который это не проверяет, зелёный и при дыре.
//
// 'jose' — чистый ESM, ts-jest его не парсит (тот же приём, что в
// google.provider.spec.ts). decodeJwt подменяем НАСТОЯЩИМ разбором payload —
// иначе офлайн-проверка claims тестировалась бы против заглушки.
jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn(() => 'FAKE_JWKS_SET'),
  jwtVerify: jest.fn(),
  decodeJwt: (token: string): unknown =>
    JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString('utf8'),
    ) as unknown,
}));

import { jwtVerify } from 'jose';
import { resetGoogleJwks, verifyGoogleIdToken } from './google-id-token';

const mockedJwtVerify = jwtVerify as jest.Mock;
const CLIENT_ID = 'client-123.apps.googleusercontent.com';
const NOW = 1_800_000_000_000; // мс
const NOW_S = NOW / 1000;

function makeToken(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString(
    'base64url',
  );
  return `header.${body}.signature`;
}

function goodPayload(overrides: Record<string, unknown> = {}) {
  return {
    iss: 'https://accounts.google.com',
    aud: CLIENT_ID,
    sub: 'google-user-1',
    email: 'anna@example.com',
    email_verified: true,
    name: 'Аня',
    iat: NOW_S - 10,
    exp: NOW_S + 3600,
    ...overrides,
  };
}

/** Ошибка jose несёт код ERR_* — по нему её отличают от сетевого сбоя. */
function joseError(code: string, message: string): Error {
  return Object.assign(new Error(message), { code });
}

beforeEach(() => {
  jest.clearAllMocks();
  resetGoogleJwks();
});

describe('verifyGoogleIdToken — обычный путь, подпись проверена', () => {
  it('отдаёт claims и помечает offline=false', async () => {
    mockedJwtVerify.mockResolvedValue({ payload: goodPayload() });

    const claims = await verifyGoogleIdToken('any.token.here', CLIENT_ID, NOW);

    expect(claims).toEqual({
      sub: 'google-user-1',
      email: 'anna@example.com',
      name: 'Аня',
      emailVerified: true,
      offline: false,
    });
  });

  it('email_verified не true — флаг снят, решение принимает вызывающий', async () => {
    mockedJwtVerify.mockResolvedValue({
      payload: goodPayload({ email_verified: false }),
    });

    const claims = await verifyGoogleIdToken('any.token.here', CLIENT_ID, NOW);
    expect(claims.emailVerified).toBe(false);
  });

  it('payload без sub — отказ (некому назначить providerId)', async () => {
    mockedJwtVerify.mockResolvedValue({ payload: goodPayload({ sub: '' }) });

    await expect(
      verifyGoogleIdToken('any.token.here', CLIENT_ID, NOW),
    ).rejects.toThrow('without sub');
  });
});

describe('verifyGoogleIdToken — JWKS недостижим (сам инцидент)', () => {
  it('«fetch failed» → claims проверены офлайн, вход проходит, offline=true', async () => {
    mockedJwtVerify.mockRejectedValue(new TypeError('fetch failed'));
    const token = makeToken(goodPayload());

    const claims = await verifyGoogleIdToken(token, CLIENT_ID, NOW);

    expect(claims.sub).toBe('google-user-1');
    expect(claims.email).toBe('anna@example.com');
    expect(claims.offline).toBe(true);
  });

  it('таймаут скачивания ключей (ERR_JWKS_TIMEOUT) — тоже сеть, тоже офлайн', async () => {
    mockedJwtVerify.mockRejectedValue(
      joseError('ERR_JWKS_TIMEOUT', 'Timeout reached when fetching the JWKS'),
    );

    const claims = await verifyGoogleIdToken(
      makeToken(goodPayload()),
      CLIENT_ID,
      NOW,
    );
    expect(claims.offline).toBe(true);
  });

  it('DNS не резолвится (ENOTFOUND) — офлайн', async () => {
    mockedJwtVerify.mockRejectedValue(
      new Error('getaddrinfo ENOTFOUND www.googleapis.com'),
    );

    const claims = await verifyGoogleIdToken(
      makeToken(goodPayload()),
      CLIENT_ID,
      NOW,
    );
    expect(claims.offline).toBe(true);
  });
});

describe('verifyGoogleIdToken — офлайн-ветка НЕ пропускает плохой токен', () => {
  beforeEach(() => {
    mockedJwtVerify.mockRejectedValue(new TypeError('fetch failed'));
  });

  it('чужой aud (токен выписан другому приложению) → отказ', async () => {
    const token = makeToken(goodPayload({ aud: 'someone-else.apps.google' }));
    await expect(verifyGoogleIdToken(token, CLIENT_ID, NOW)).rejects.toThrow(
      '"aud"',
    );
  });

  it('aud массивом, нашего client_id в нём нет → отказ', async () => {
    const token = makeToken(goodPayload({ aud: ['a', 'b'] }));
    await expect(verifyGoogleIdToken(token, CLIENT_ID, NOW)).rejects.toThrow(
      '"aud"',
    );
  });

  it('aud массивом, наш client_id внутри → принят', async () => {
    const token = makeToken(goodPayload({ aud: ['other', CLIENT_ID] }));
    await expect(
      verifyGoogleIdToken(token, CLIENT_ID, NOW),
    ).resolves.toMatchObject({ offline: true });
  });

  it('чужой issuer (не Google) → отказ', async () => {
    const token = makeToken(goodPayload({ iss: 'https://evil.example' }));
    await expect(verifyGoogleIdToken(token, CLIENT_ID, NOW)).rejects.toThrow(
      '"iss"',
    );
  });

  it('просроченный токен → отказ (запас на часы не спасает старый exp)', async () => {
    const token = makeToken(goodPayload({ exp: NOW_S - 3600 }));
    await expect(verifyGoogleIdToken(token, CLIENT_ID, NOW)).rejects.toThrow(
      '"exp"',
    );
  });

  it('exp вовсе нет → отказ', async () => {
    const token = makeToken(goodPayload({ exp: undefined }));
    await expect(verifyGoogleIdToken(token, CLIENT_ID, NOW)).rejects.toThrow(
      '"exp"',
    );
  });

  it('токен из будущего (iat вперёд на сутки) → отказ', async () => {
    const token = makeToken(goodPayload({ iat: NOW_S + 86_400 }));
    await expect(verifyGoogleIdToken(token, CLIENT_ID, NOW)).rejects.toThrow(
      '"iat"',
    );
  });
});

describe('verifyGoogleIdToken — сеть жива, вердикт по токену финален', () => {
  it.each([
    ['ERR_JWS_SIGNATURE_VERIFICATION_FAILED', 'signature verification failed'],
    ['ERR_JWT_CLAIM_VALIDATION_FAILED', 'unexpected "aud" claim value'],
    ['ERR_JWT_EXPIRED', '"exp" claim timestamp check failed'],
    [
      'ERR_JWKS_NO_MATCHING_KEY',
      'no applicable key found in the JSON Web Key Set',
    ],
  ])('%s — офлайн-ветка не включается, отказ', async (code, message) => {
    mockedJwtVerify.mockRejectedValue(joseError(code, message));
    // Claims у токена идеальные: если бы офлайн-ветка включилась, вход бы прошёл.
    const token = makeToken(goodPayload());

    await expect(verifyGoogleIdToken(token, CLIENT_ID, NOW)).rejects.toThrow(
      message,
    );
  });

  it('ошибка без кода и без сетевых слов — тоже отказ', async () => {
    mockedJwtVerify.mockRejectedValue(new Error('Invalid Compact JWS'));
    await expect(
      verifyGoogleIdToken(makeToken(goodPayload()), CLIENT_ID, NOW),
    ).rejects.toThrow('Invalid Compact JWS');
  });
});
