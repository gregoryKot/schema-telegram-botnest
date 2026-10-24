// Nonce One Tap: кука с секретом, хеш наружу, проверка и погашение.
import { createHash } from 'crypto';
import {
  GSI_NONCE_COOKIE,
  assertOneTapNonce,
  clearOneTapNonce,
  issueOneTapNonce,
} from './google-one-tap-nonce';

const makeRes = () => ({ cookie: jest.fn(), clearCookie: jest.fn() });

describe('issueOneTapNonce', () => {
  it('ставит httpOnly/secure/lax-куку на 10 минут с path /api/auth; наружу — SHA-256 секрета, не сам секрет', () => {
    const res = makeRes();
    const { nonce } = issueOneTapNonce(res as never);
    const [name, secret, opts] = res.cookie.mock.calls[0];
    expect(name).toBe(GSI_NONCE_COOKIE);
    expect(opts).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 600_000,
      path: '/api/auth',
    });
    expect(secret).not.toBe(nonce);
    expect(nonce).toBe(createHash('sha256').update(secret).digest('hex'));
  });

  it('каждый вызов — новый секрет (32 байта)', () => {
    const a = makeRes();
    const b = makeRes();
    issueOneTapNonce(a as never);
    issueOneTapNonce(b as never);
    expect(a.cookie.mock.calls[0][1]).not.toBe(b.cookie.mock.calls[0][1]);
    expect(Buffer.from(a.cookie.mock.calls[0][1], 'base64url')).toHaveLength(
      32,
    );
  });
});

describe('assertOneTapNonce', () => {
  const nonce = createHash('sha256').update('S').digest('hex');
  it('совпало → тихо', () => {
    expect(() =>
      assertOneTapNonce({ nonce, offline: false }, 'S'),
    ).not.toThrow();
  });
  it.each([
    [{ nonce, offline: false }, undefined],
    [{ nonce: undefined, offline: false }, 'S'],
    [{ nonce, offline: false }, 'другая'],
    [{ nonce, offline: true }, 'S'],
  ])('%j / кука %p → отказ', (claims, cookie) => {
    expect(() => assertOneTapNonce(claims, cookie)).toThrow('nonce invalid');
  });
});

describe('clearOneTapNonce', () => {
  it('гасит куку по тому же path', () => {
    const res = makeRes();
    clearOneTapNonce(res as never);
    expect(res.clearCookie).toHaveBeenCalledWith(GSI_NONCE_COOKIE, {
      path: '/api/auth',
    });
  });
});
