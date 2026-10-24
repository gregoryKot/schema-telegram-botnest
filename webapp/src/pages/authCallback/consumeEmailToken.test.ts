// @vitest-environment jsdom
// Ссылка из письма (B-14 аудита 2026-10): токен гасит POST со страницы сайта.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { consumeEmailToken, emailConsumeNextPath } from './consumeEmailToken';

afterEach(() => vi.unstubAllGlobals());

const reply = (status: number, body: unknown) =>
  vi.fn().mockResolvedValue({
    ok: status < 400,
    status,
    json: () => Promise.resolve(body),
  });

describe('consumeEmailToken', () => {
  it('POST /api/auth/email/consume с куками, CSRF-заголовком и токеном в теле', async () => {
    const f = reply(200, { accessToken: 'AT', expiresIn: 900 });
    vi.stubGlobal('fetch', f);
    await consumeEmailToken('', 'raw-tok');
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('/api/auth/email/consume');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
    expect(init.headers['x-requested-with']).toBeTruthy();
    expect(JSON.parse(init.body)).toEqual({ token: 'raw-tok' });
  });

  it('три успешных исхода различаются по телу', async () => {
    vi.stubGlobal('fetch', reply(200, { accessToken: 'AT', expiresIn: 600 }));
    await expect(consumeEmailToken('', 't')).resolves.toEqual({
      kind: 'session',
      accessToken: 'AT',
      expiresIn: 600,
    });
    vi.stubGlobal('fetch', reply(200, { challengeToken: 'CH' }));
    await expect(consumeEmailToken('', 't')).resolves.toEqual({
      kind: 'twofa',
      challengeToken: 'CH',
    });
    vi.stubGlobal('fetch', reply(200, { linked: true }));
    await expect(consumeEmailToken('', 't')).resolves.toEqual({ kind: 'linked' });
  });

  it('нет expiresIn → 900 по умолчанию', async () => {
    vi.stubGlobal('fetch', reply(200, { accessToken: 'AT' }));
    await expect(consumeEmailToken('', 't')).resolves.toMatchObject({
      expiresIn: 900,
    });
  });

  it.each([
    ['просрочен/сожжён (401 без reason)', reply(401, { message: 'Token expired' }), 'email_link_expired'],
    ['не тот браузер', reply(401, { reason: 'email_link_session' }), 'email_link_session'],
    ['адрес занят', reply(409, { reason: 'email_taken' }), 'email_taken'],
    ['чужой reason не пропускаем', reply(401, { reason: 'что-то-другое' }), 'email_link_expired'],
    ['сеть легла', vi.fn().mockRejectedValue(new Error('down')), 'email_link_expired'],
    ['200 без нужных полей', reply(200, {}), 'email_link_expired'],
  ])('%s → error %s', async (_n, f, reason) => {
    vi.stubGlobal('fetch', f);
    await expect(consumeEmailToken('', 't')).resolves.toEqual({
      kind: 'error',
      reason,
    });
  });
});

describe('emailConsumeNextPath', () => {
  const session = { kind: 'session', accessToken: 'AT', expiresIn: 900 } as const;

  it('сессия без билета → returnTo или /today', () => {
    expect(emailConsumeNextPath(session, null, null)).toBe('/today');
    expect(emailConsumeNextPath(session, null, '/practice')).toBe('/practice');
  });

  it('сессия с билетом → экран сверки, токен во фрагменте (сервер не одобряет молча)', () => {
    expect(emailConsumeNextPath(session, 'K7M2QX94', '/practice')).toBe(
      '/auth/confirm?code=K7M2QX94#access_token=AT&expires_in=900',
    );
  });

  it('2FA → /auth/2fa с challengeToken; привязка → /account?linked=email', () => {
    expect(
      emailConsumeNextPath({ kind: 'twofa', challengeToken: 'a b' }, null, null),
    ).toBe('/auth/2fa?token=a%20b');
    expect(emailConsumeNextPath({ kind: 'linked' }, 'T', null)).toBe(
      '/account?linked=email',
    );
  });

  it('ошибки: просрочка → экран ошибки входа; остальное — подсказка на аккаунте', () => {
    expect(
      emailConsumeNextPath({ kind: 'error', reason: 'email_link_expired' }, null, null),
    ).toBe('/auth/error?reason=email_link_expired');
    expect(
      emailConsumeNextPath({ kind: 'error', reason: 'email_taken' }, null, null),
    ).toBe('/account?error=email_taken');
    expect(
      emailConsumeNextPath({ kind: 'error', reason: 'email_link_session' }, null, null),
    ).toBe('/account?error=email_link_session');
  });
});
