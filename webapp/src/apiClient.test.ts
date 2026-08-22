// @vitest-environment jsdom
// apiClient.ts — HTTP-инфраструктура сайта, зеркало schema-miniapp/apiClient.ts
// (правило №3). Диагностика «постоянно нужно логиниться заново» (2026-08-21,
// пункт 4): раньше на 401 сайт просто бросал ошибку, здесь фиксируем
// authedFetch напрямую (api.test.ts проверяет то же поведение через
// доменные методы api.*, этот файл — саму транспортную обёртку).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  authedFetch,
  get,
  setTokenProvider,
  setRefreshHandler,
} from './apiClient';

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
  setTokenProvider(() => null);
  setRefreshHandler(() => Promise.resolve(false));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('authedFetch', () => {
  it('refresh не удался (или не настроен) — 401 отдаётся как есть, один запрос', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, {}));
    const res = await authedFetch('/api/settings');
    expect(res.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('успешный refresh повторяет запрос с новым токеном', async () => {
    let token = 'old';
    setTokenProvider(() => token);
    setRefreshHandler(() => {
      token = 'new';
      return Promise.resolve(true);
    });
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, {}))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));

    const res = await authedFetch('/api/settings');
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, retryInit] = fetchMock.mock.calls[1];
    expect((retryInit.headers as Record<string, string>).Authorization).toBe('Bearer new');
  });

  it('200 не трогает refresh-хэндлер вовсе', async () => {
    const refresh = vi.fn();
    setRefreshHandler(refresh);
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    await authedFetch('/api/settings');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('get<T> пробрасывает данные после успешного retry', async () => {
    setRefreshHandler(() => Promise.resolve(true));
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, {}))
      .mockResolvedValueOnce(jsonResponse(200, { addressForm: 'vy' }));
    await expect(get('/api/settings')).resolves.toEqual({ addressForm: 'vy' });
  });
});
