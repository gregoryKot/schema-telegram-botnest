// @vitest-environment jsdom
// telegramWebAppAuth — вынесено из AuthProvider.tsx (файл-храповик).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { telegramWebAppAuth } from './telegramWebAppAuth';
import { REQUEST_TIMEOUT_MS } from '../../../shared/src/api/fetchWithTimeout';

interface TelegramWindow extends Window {
  Telegram?: { WebApp?: { initData?: string } };
}

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
  delete (window as unknown as TelegramWindow).Telegram;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete (window as unknown as TelegramWindow).Telegram;
});

describe('telegramWebAppAuth', () => {
  it('без Telegram initData (обычный веб) — ok:false, сеть не трогаем', async () => {
    await expect(telegramWebAppAuth()).resolves.toEqual({ ok: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('успех — отдаёт токен и expiresIn', async () => {
    (window as unknown as TelegramWindow).Telegram = { WebApp: { initData: 'query_id=AAA&user=%7B%7D' } };
    fetchMock.mockResolvedValue(jsonResponse(200, { accessToken: 'tg-tok', expiresIn: 900 }));
    await expect(telegramWebAppAuth()).resolves.toEqual({ ok: true, token: 'tg-tok', expiresIn: 900 });
  });

  it('не ok от сервера — ok:false', async () => {
    (window as unknown as TelegramWindow).Telegram = { WebApp: { initData: 'query_id=AAA&user=%7B%7D' } };
    fetchMock.mockResolvedValue(jsonResponse(401, {}));
    await expect(telegramWebAppAuth()).resolves.toEqual({ ok: false });
  });

  it('сетевая ошибка — ok:false, не бросает', async () => {
    (window as unknown as TelegramWindow).Telegram = { WebApp: { initData: 'query_id=AAA&user=%7B%7D' } };
    fetchMock.mockRejectedValue(new TypeError('offline'));
    await expect(telegramWebAppAuth()).resolves.toEqual({ ok: false });
  });

  // Аудит 2026-11, E9: вход из мессенджера на зависшей сети крутил спиннер вечно.
  it('зависшая сеть — ok:false за таймаут', async () => {
    vi.useFakeTimers();
    (window as unknown as TelegramWindow).Telegram = { WebApp: { initData: 'query_id=AAA&user=%7B%7D' } };
    fetchMock.mockImplementation((_url: string, init: RequestInit) => new Promise((_, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    }));
    const outcome = vi.fn();
    const p = telegramWebAppAuth().then(outcome);
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
    await p;
    expect(outcome).toHaveBeenCalledWith({ ok: false });
    vi.useRealTimers();
  });
});
