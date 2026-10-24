// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchOneTapNonce } from './oneTapNonce';

afterEach(() => vi.unstubAllGlobals());

const reply = (ok: boolean, body: unknown) =>
  vi.fn().mockResolvedValue({ ok, json: () => Promise.resolve(body) });

describe('fetchOneTapNonce', () => {
  it('GET с куками, возвращает nonce', async () => {
    const f = reply(true, { nonce: 'abc' });
    vi.stubGlobal('fetch', f);
    await expect(fetchOneTapNonce('https://x.ru')).resolves.toBe('abc');
    expect(f).toHaveBeenCalledWith('https://x.ru/api/auth/google/one-tap/nonce', {
      credentials: 'include',
    });
  });

  it.each([
    ['не-2xx', reply(false, { nonce: 'abc' })],
    ['нет поля', reply(true, {})],
    ['не строка', reply(true, { nonce: 5 })],
    ['пустая строка', reply(true, { nonce: '' })],
    ['сеть легла', vi.fn().mockRejectedValue(new Error('down'))],
  ])('%s → null', async (_n, f) => {
    vi.stubGlobal('fetch', f);
    await expect(fetchOneTapNonce('')).resolves.toBeNull();
  });
});
