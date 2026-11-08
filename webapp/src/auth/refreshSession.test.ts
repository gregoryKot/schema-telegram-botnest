// refreshSession — регресс «постоянно нужно логиниться заново» (диагностика
// 2026-08-21): 401/403 от /api/auth/refresh — сессия мертва; сеть/5xx/429 —
// временная беда, ретраится и НЕ считается мёртвой. Плюс единый in-flight
// промис на параллельные вызовы (иначе сервер видит кражу refresh-токена).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { refreshSession, resetRefreshLockForTests } from './refreshSession';
import { REQUEST_TIMEOUT_MS } from '../../../shared/src/api/fetchWithTimeout';
import { REFRESH_RETRY_DELAYS_MS } from '../../../shared/src/auth/sessionRefresh';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('refreshSession', () => {
  it('успех — возвращает токен и не ретраит', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { accessToken: 'tok', expiresIn: 900 }));
    await expect(refreshSession()).resolves.toEqual({ ok: true, token: 'tok', expiresIn: 900 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('401 — dead:true немедленно, без ретраев', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, {}));
    await expect(refreshSession()).resolves.toEqual({ ok: false, dead: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('403 — тоже dead:true (не только 401)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(403, {}));
    await expect(refreshSession()).resolves.toEqual({ ok: false, dead: true });
  });

  it('500 — временная беда: ретраится и в итоге dead:false', async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(jsonResponse(500, {}));
    const promise = refreshSession();
    for (const ms of REFRESH_RETRY_DELAYS_MS) {
      await vi.advanceTimersByTimeAsync(ms);
    }
    await expect(promise).resolves.toEqual({ ok: false, dead: false });
    expect(fetchMock.mock.calls.length).toBe(REFRESH_RETRY_DELAYS_MS.length + 1);
  });

  it('сетевая ошибка (fetch throws) — тоже dead:false, ретраится', async () => {
    vi.useFakeTimers();
    fetchMock.mockRejectedValue(new TypeError('offline'));
    const promise = refreshSession();
    for (const ms of REFRESH_RETRY_DELAYS_MS) {
      await vi.advanceTimersByTimeAsync(ms);
    }
    await expect(promise).resolves.toEqual({ ok: false, dead: false });
  });

  it('временная беда, потом успех — восстанавливается без dead', async () => {
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(500, {}))
      .mockResolvedValueOnce(jsonResponse(200, { accessToken: 'recovered', expiresIn: 900 }));
    const promise = refreshSession();
    await vi.advanceTimersByTimeAsync(REFRESH_RETRY_DELAYS_MS[0]);
    await expect(promise).resolves.toEqual({ ok: true, token: 'recovered', expiresIn: 900 });
  });

  it('параллельные вызовы делят один промис — один сетевой вызов', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { accessToken: 'tok', expiresIn: 900 }));
    const [a, b, c] = await Promise.all([refreshSession(), refreshSession(), refreshSession()]);
    expect(a).toEqual(b);
    expect(b).toEqual(c);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('после завершения следующий вызов делает новый запрос (замок не залипает)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { accessToken: 'tok', expiresIn: 900 }));
    await refreshSession();
    await refreshSession();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  // Аудит 2026-11, E9: голый fetch на зависшей сети — вечный спиннер входа.
  it('зависший refresh — за таймаут каждой попытки исход «временная беда», не «сессия мертва»', async () => {
    resetRefreshLockForTests();
    vi.useFakeTimers();
    fetchMock.mockImplementation((_url: string, init: RequestInit) => new Promise((_, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    }));
    const outcome = vi.fn();
    const p = refreshSession().then(outcome);
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
    for (const ms of REFRESH_RETRY_DELAYS_MS) await vi.advanceTimersByTimeAsync(ms + REQUEST_TIMEOUT_MS);
    await p;
    expect(outcome).toHaveBeenCalledWith({ ok: false, dead: false });
    expect(fetchMock).toHaveBeenCalledTimes(REFRESH_RETRY_DELAYS_MS.length + 1);
  });
});
