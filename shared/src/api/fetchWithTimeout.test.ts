// fetchWithTimeout — потолок ожидания запросов входа и выхода (аудит 2026-11, E9).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchWithTimeout, REQUEST_TIMEOUT_MS } from './fetchWithTimeout';

// Зависшая сеть: ответа нет, пока запрос не оборвут.
const hang = (_url: string, init: RequestInit) =>
  new Promise<Response>((_, reject) => {
    init.signal?.addEventListener('abort', () =>
      reject(new DOMException('aborted', 'AbortError')),
    );
  });

let fetchMock: ReturnType<typeof vi.fn<typeof hang>>;
beforeEach(() => {
  vi.useFakeTimers();
  fetchMock = vi.fn<typeof hang>();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('fetchWithTimeout', () => {
  it('зависший запрос обрывается ровно по таймауту (AbortError), а не висит', async () => {
    fetchMock.mockImplementation(hang);
    const settled = vi.fn();
    const p = fetchWithTimeout('/api/x', { method: 'POST' }).catch(
      (e: unknown) => {
        settled(e);
      },
    );
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS - 1);
    expect(settled).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await p;
    expect((settled.mock.calls[0][0] as DOMException).name).toBe('AbortError');
  });

  it('ответ до таймаута проходит как есть, с исходными полями запроса и без висящего таймера', async () => {
    const res = { ok: true } as Response;
    fetchMock.mockResolvedValue(res);
    await expect(
      fetchWithTimeout(
        '/api/x',
        { method: 'POST', credentials: 'include' },
        1000,
      ),
    ).resolves.toBe(res);
    const init = fetchMock.mock.calls[0][1];
    expect(init).toMatchObject({ method: 'POST', credentials: 'include' });
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(vi.getTimerCount()).toBe(0);
  });
});
