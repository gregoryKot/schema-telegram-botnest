// @vitest-environment jsdom
// Инцидент 2026-07-29: истёкшая initData → 401 на КАЖДЫЙ запрос, и приложение
// молча переставало работать (все вызовы обёрнуты в .catch(() => {})).
// Здесь проверяем связку «401 → перевыпуск сессии → повтор», включая случай,
// когда чинить нечем: тогда экран обязан узнать об этом событием.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get, post } from './apiClient';
import { clearSession, SESSION_EXPIRED_EVENT } from './session';

function jsonRes(status: number, body: unknown = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  };
}

function fetchMock() {
  return global.fetch as unknown as ReturnType<typeof vi.fn>;
}

const urls = () => fetchMock().mock.calls.map((c) => String(c[0]));

beforeEach(() => {
  clearSession();
  global.fetch = vi.fn();
  (window as unknown as { Telegram?: unknown }).Telegram = {
    WebApp: { initData: 'query_id=AAA&hash=deadbeef' },
  };
});

afterEach(() => {
  vi.restoreAllMocks();
  clearSession();
  delete (window as unknown as { Telegram?: unknown }).Telegram;
});

describe('authedFetch: 401 → перевыпуск сессии → повтор', () => {
  it('протухшая initData: запрос доезжает со второй попытки, уже с Bearer', async () => {
    fetchMock()
      .mockResolvedValueOnce(jsonRes(401, {})) // GET с протухшей initData
      .mockResolvedValueOnce(
        jsonRes(200, { accessToken: 'tok', expiresIn: 900 }),
      ) // refresh по куке
      .mockResolvedValueOnce(jsonRes(200, { accepted: true })); // повтор

    await expect(
      get<{ accepted: boolean }>('/api/disclaimer'),
    ).resolves.toEqual({ accepted: true });
    expect(urls()).toEqual([
      '/api/disclaimer',
      '/api/auth/refresh',
      '/api/disclaimer',
    ]);
    const [, retryInit] = fetchMock().mock.calls[2];
    const headers = (retryInit as RequestInit).headers as Record<
      string,
      string
    >;
    expect(headers.Authorization).toBe('Bearer tok');
  });

  it('POST тоже повторяется — оценка не теряется из-за истёкшей сессии', async () => {
    fetchMock()
      .mockResolvedValueOnce(jsonRes(401, {}))
      .mockResolvedValueOnce(
        jsonRes(200, { accessToken: 'tok', expiresIn: 900 }),
      )
      .mockResolvedValueOnce(jsonRes(200, {}));

    await expect(post('/api/disclaimer', { a: 1 })).resolves.toBeUndefined();
    const [, retryInit] = fetchMock().mock.calls[2];
    expect(JSON.parse((retryInit as RequestInit).body as string)).toEqual({
      a: 1,
    });
  });

  it('перевыпуск невозможен → событие для экрана + понятная ошибка', async () => {
    const onExpired = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    fetchMock().mockResolvedValue(jsonRes(401, {}));

    await expect(get('/api/disclaimer')).rejects.toThrow('API error: 401');
    expect(onExpired).toHaveBeenCalledTimes(1);
    window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  });

  it('успешный запрос не трогает сессию — лишних обращений к /api/auth нет', async () => {
    fetchMock().mockResolvedValue(jsonRes(200, {}));
    await get('/api/disclaimer');
    expect(urls()).toEqual(['/api/disclaimer']);
  });

  it('403 не считается истёкшей сессией — перевыпуска нет', async () => {
    fetchMock().mockResolvedValue(jsonRes(403, {}));
    await expect(get('/api/disclaimer')).rejects.toThrow('API error: 403');
    expect(urls()).toEqual(['/api/disclaimer']);
  });
});
