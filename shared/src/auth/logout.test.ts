import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { postLogout } from './logout';
import { REQUEST_TIMEOUT_MS } from '../api/fetchWithTimeout';

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('postLogout', () => {
  it('POST /api/auth/logout с CSRF-заголовком и кукой сессии', async () => {
    await postLogout('', { requestedWith: 'miniapp' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/auth/logout');
    expect(init.method).toBe('POST');
    // credentials:include — refresh-кука обязана уйти с запросом, иначе сервер
    // не поймёт, какую сессию гасить.
    expect(init.credentials).toBe('include');
    // requireCsrf пускает по непустому x-requested-with ИЛИ application/json.
    expect(init.headers['x-requested-with']).toBe('miniapp');
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('all:true → ?all=true (выход со всех устройств)', async () => {
    await postLogout('https://api.test', {
      all: true,
      requestedWith: 'webapp',
    });
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.test/api/auth/logout?all=true',
    );
  });

  it('сеть легла (fetch бросает) — не пробрасывает: локальный выход всё равно состоится', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    await expect(
      postLogout('', { requestedWith: 'webapp' }),
    ).resolves.toBeUndefined();
  });

  // Аудит 2026-11, E9: голый fetch на зависшей сети держал «Выйти» вечно.
  it('зависшая сеть — выход не ждёт дольше таймаута', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_, reject) => {
            init.signal?.addEventListener('abort', () =>
              reject(new DOMException('aborted', 'AbortError')),
            );
          }),
      ),
    );
    const done = vi.fn();
    const p = postLogout('', { requestedWith: 'webapp' }).then(done);
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
    await p;
    expect(done).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});
