// @vitest-environment jsdom
// Ссылка привязки почты из письма (B-14 аудита 2026-10): токен гасит POST со
// страницы сайта. Вход по ссылке отключён — сессия в ответе исходом не считается.
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
    const f = reply(200, { linked: true });
    vi.stubGlobal('fetch', f);
    await consumeEmailToken('', 'raw-tok');
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('/api/auth/email/consume');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
    expect(init.headers['x-requested-with']).toBeTruthy();
    expect(JSON.parse(init.body)).toEqual({ token: 'raw-tok' });
  });

  it('успех привязки — { linked: true }', async () => {
    vi.stubGlobal('fetch', reply(200, { linked: true }));
    await expect(consumeEmailToken('', 't')).resolves.toEqual({ kind: 'linked' });
  });

  it.each([
    ['просрочен/сожжён (401 без reason)', reply(401, { message: 'Token expired' }), 'email_link_expired'],
    ['не тот браузер', reply(401, { reason: 'email_link_session' }), 'email_link_session'],
    ['адрес занят', reply(409, { reason: 'email_taken' }), 'email_taken'],
    ['чужой reason не пропускаем', reply(401, { reason: 'что-то-другое' }), 'email_link_expired'],
    // U6 (аудит 2026-11): сеть и сбой сервера — не «ссылка устарела».
    ['сеть легла', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')), 'email_network'],
    ['лимит попыток', reply(429, { message: 'Too Many Requests' }), 'http_429'],
    ['сервер упал (HTML вместо JSON)', vi.fn().mockResolvedValue({ ok: false, status: 502, json: () => Promise.reject(new SyntaxError('x')) }), 'http_502'],
    ['200 без нужных полей', reply(200, {}), 'email_link_expired'],
    // Старая ссылка входа: сервер ещё отдаёт сессию или 2FA — это не привязка.
    ['200 с сессией (ссылка входа)', reply(200, { accessToken: 'AT', expiresIn: 900 }), 'email_link_expired'],
    ['200 с 2FA (ссылка входа)', reply(200, { challengeToken: 'CH' }), 'email_link_expired'],
  ])('%s → error %s', async (_n, f, reason) => {
    vi.stubGlobal('fetch', f);
    await expect(consumeEmailToken('', 't')).resolves.toEqual({
      kind: 'error',
      reason,
    });
  });
});

describe('emailConsumeNextPath', () => {
  it('привязка → /account?linked=email', () => {
    expect(emailConsumeNextPath({ kind: 'linked' })).toBe('/account?linked=email');
  });

  it('ошибки: просрочка → экран ошибки ссылки; адрес занят и чужой браузер — подсказка на аккаунте', () => {
    expect(emailConsumeNextPath({ kind: 'error', reason: 'email_link_expired' })).toBe('/auth/error?reason=email_link_expired');
    expect(emailConsumeNextPath({ kind: 'error', reason: 'email_taken' })).toBe('/account?error=email_taken');
    expect(emailConsumeNextPath({ kind: 'error', reason: 'email_link_session' })).toBe('/account?error=email_link_session');
  });

  it('сеть и ответ сервера — свои коды на экране ошибки, не на аккаунте', () => {
    expect(emailConsumeNextPath({ kind: 'error', reason: 'email_network' })).toBe('/auth/error?reason=email_network');
    expect(emailConsumeNextPath({ kind: 'error', reason: 'http_429' })).toBe('/auth/error?reason=http_429');
  });
});
