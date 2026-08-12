// Регрессия на C1 (аудит 2026-08-12): носитель linkUserId (OAuth-`state`,
// `tg_link_user`-кука) обязан быть ПОДПИСАН. Неподписанный носитель давал
// неаутентифицированный захват любого аккаунта — атакующий подделывал
// linkUserId=<жертва>, предъявлял свой provider-code и получал сессию жертвы
// в обход 2FA. Эти тесты фиксируют, что подделка отвергается.
import * as jwt from 'jsonwebtoken';
import { signOAuthState, readOAuthState } from './oauth-state';

const SECRET = 'test-jwt-secret';
const ISS = 'schemehappens.ru';

describe('oauth-state — подписанный носитель linkUserId (C1)', () => {
  it('roundtrip: linkUserId сохраняется', () => {
    expect(readOAuthState(SECRET, signOAuthState(SECRET, 42n))).toBe(42n);
  });

  it('linkUserId=null → null (анонимный вход)', () => {
    expect(readOAuthState(SECRET, signOAuthState(SECRET, null))).toBeNull();
  });

  it('РЕГРЕССИЯ C1: неподписанный base64url JSON (старый формат = вектор атаки) → null', () => {
    // Ровно то, что слал бы атакующий: linkUserId=<жертва> без подписи.
    const forged = Buffer.from(
      JSON.stringify({ nonce: 'x', linkUserId: '999' }),
    ).toString('base64url');
    expect(readOAuthState(SECRET, forged)).toBeNull();
  });

  it('битый/пустой вход → null, не бросает', () => {
    expect(readOAuthState(SECRET, 'not-a-jwt!!!')).toBeNull();
    expect(readOAuthState(SECRET, '')).toBeNull();
    expect(readOAuthState(SECRET, null)).toBeNull();
    expect(readOAuthState(SECRET, undefined)).toBeNull();
  });

  it('подписан ДРУГИМ секретом → null', () => {
    const state = signOAuthState('attacker-secret', 999n);
    expect(readOAuthState(SECRET, state)).toBeNull();
  });

  it('другой kind (тот же секрет, валидные iss/aud) не принимается как state → null', () => {
    const token = jwt.sign({ kind: 'access', link: '999' }, SECRET, {
      algorithm: 'HS256',
      issuer: ISS,
      audience: ISS,
      expiresIn: 600,
    });
    expect(readOAuthState(SECRET, token)).toBeNull();
  });

  it('tampered payload (подменён link, подпись старая) → null', () => {
    const state = signOAuthState(SECRET, 42n);
    const [header, , signature] = state.split('.');
    const badPayload = Buffer.from(
      JSON.stringify({ kind: 'oauth_state', link: '999' }),
    ).toString('base64url');
    expect(
      readOAuthState(SECRET, `${header}.${badPayload}.${signature}`),
    ).toBeNull();
  });

  it('просроченный state → null', () => {
    const token = jwt.sign({ kind: 'oauth_state', link: '42' }, SECRET, {
      algorithm: 'HS256',
      issuer: ISS,
      audience: ISS,
      expiresIn: -1,
    });
    expect(readOAuthState(SECRET, token)).toBeNull();
  });
});
