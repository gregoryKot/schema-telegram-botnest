// @vitest-environment jsdom
// Регрессия инцидента 2026-07-29: Telegram выдаёт initData один раз, при
// открытии мини-аппа, и не обновляет её. Свернул на час, открыл — каждый запрос
// 401, приложение молча не работает, а бэкенд шлёт админу по алерту на запрос.
// Лечение проверяем здесь: сессия выпускается, пока подпись свежая, а 401
// чинится перевыпуском (и ровно одним — параллельная ротация refresh-токена
// выглядит для сервера кражей и отзывает всю семью токенов).
//
// Плюс регрессия «постоянно нужно логиниться заново» (диагностика
// 2026-08-21): временная ошибка refresh (сеть/5xx/429) не должна вести себя
// как 401/403 — сессия остаётся живой, ретраится с бэкоффом, isSessionDead()
// возвращает false.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  authHeaders,
  clearSession,
  ensureSession,
  isSessionDead,
  renewSession,
  markSessionExpired,
  SESSION_EXPIRED_EVENT,
} from './session';
import { REFRESH_RETRY_DELAYS_MS } from '../../shared/src/auth/sessionRefresh';

const INIT_DATA = 'query_id=AAA&user=%7B%7D&hash=deadbeef';

function jsonRes(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  };
}

const okToken = (token = 'tok-1') =>
  jsonRes(200, { accessToken: token, expiresIn: 900 });

function fetchMock() {
  return global.fetch as unknown as ReturnType<typeof vi.fn>;
}

function urlsCalled(): string[] {
  return fetchMock().mock.calls.map((c) => String(c[0]));
}

/** Продвигает фейковые таймеры через весь бэкофф ретраев (см. REFRESH_RETRY_DELAYS_MS). */
async function flushRetryBackoff(): Promise<void> {
  for (const ms of REFRESH_RETRY_DELAYS_MS) {
    await vi.advanceTimersByTimeAsync(ms);
  }
}

beforeEach(() => {
  clearSession();
  global.fetch = vi.fn();
  (window as unknown as { Telegram?: unknown }).Telegram = {
    WebApp: { initData: INIT_DATA },
  };
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  clearSession();
  delete (window as unknown as { Telegram?: unknown }).Telegram;
});

describe('authHeaders', () => {
  it('без сессии шлёт initData (первый вход)', () => {
    expect(authHeaders()).toEqual({
      'x-telegram-init-data': INIT_DATA,
      'Content-Type': 'application/json',
    });
  });

  it('вне мессенджера подписи нет — остаётся только Content-Type', () => {
    delete (window as unknown as { Telegram?: unknown }).Telegram;
    expect(authHeaders()).toEqual({ 'Content-Type': 'application/json' });
  });

  it('после выпуска сессии шлёт Bearer вместо протухающей initData', async () => {
    fetchMock().mockResolvedValueOnce(jsonRes(401, {}));
    fetchMock().mockResolvedValueOnce(okToken());
    await ensureSession();
    expect(authHeaders()).toEqual({
      Authorization: 'Bearer tok-1',
      'Content-Type': 'application/json',
    });
  });
});

describe('renewSession', () => {
  it('сначала refresh-кука: свернутое на час приложение не зависит от initData', async () => {
    fetchMock().mockResolvedValueOnce(okToken('from-cookie'));
    await expect(renewSession()).resolves.toBe(true);
    expect(urlsCalled()).toEqual(['/api/auth/refresh']);
    expect(authHeaders().Authorization).toBe('Bearer from-cookie');
  });

  it('нет куки → обмен initData (первый вход)', async () => {
    fetchMock().mockResolvedValueOnce(jsonRes(401, {}));
    fetchMock().mockResolvedValueOnce(okToken('from-initdata'));
    await expect(renewSession()).resolves.toBe(true);
    expect(urlsCalled()).toEqual([
      '/api/auth/refresh',
      '/api/auth/telegram/webapp',
    ]);
    const [, init] = fetchMock().mock.calls[1];
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      initData: INIT_DATA,
    });
    expect((init as RequestInit).credentials).toBe('include');
  });

  it('ни куки, ни живой initData (401/403 от обоих) → false, сессия ПОДТВЕРЖДЁННО мертва', async () => {
    fetchMock().mockResolvedValue(jsonRes(401, {}));
    await expect(renewSession()).resolves.toBe(false);
    expect(isSessionDead()).toBe(true);
  });

  it('403 тоже считается мёртвой сессией, не только 401', async () => {
    fetchMock().mockResolvedValue(jsonRes(403, {}));
    await expect(renewSession()).resolves.toBe(false);
    expect(isSessionDead()).toBe(true);
  });

  it('живой токен не перевыпускается — лишних запросов нет', async () => {
    fetchMock().mockResolvedValueOnce(okToken());
    await renewSession();
    fetchMock().mockClear();
    await expect(renewSession()).resolves.toBe(true);
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it('параллельные вызовы делят один запрос (иначе сервер сочтёт это кражей refresh-токена)', async () => {
    fetchMock().mockResolvedValue(okToken());
    const results = await Promise.all([
      renewSession(),
      renewSession(),
      renewSession(),
    ]);
    expect(results).toEqual([true, true, true]);
    expect(fetchMock()).toHaveBeenCalledTimes(1);
  });

  it('после подтверждённой смерти держит паузу, а не долбит сервер на каждом запросе', async () => {
    fetchMock().mockResolvedValue(jsonRes(401, {}));
    await renewSession();
    const callsAfterFirst = fetchMock().mock.calls.length;
    await expect(renewSession()).resolves.toBe(false);
    expect(fetchMock().mock.calls.length).toBe(callsAfterFirst);
  });

  it('сетевая ошибка ретраится с бэкоффом и в итоге — false, но сессия НЕ мертва (2026-08-21)', async () => {
    vi.useFakeTimers();
    fetchMock().mockRejectedValue(new TypeError('offline'));
    const promise = renewSession();
    await flushRetryBackoff();
    await expect(promise).resolves.toBe(false);
    expect(isSessionDead()).toBe(false);
    // Первая попытка цикла (refresh+exchange) + одна на каждую задержку бэкоффа.
    expect(fetchMock().mock.calls.length).toBeGreaterThan(2);
  });

  it('500 на refresh — тоже временная беда: сессия жива после исчерпания ретраев', async () => {
    vi.useFakeTimers();
    fetchMock().mockResolvedValue(jsonRes(500, {}));
    const promise = renewSession();
    await flushRetryBackoff();
    await expect(promise).resolves.toBe(false);
    expect(isSessionDead()).toBe(false);
  });

  it('временная беда на первой попытке, успех на второй — сессия восстанавливается', async () => {
    vi.useFakeTimers();
    fetchMock()
      .mockResolvedValueOnce(jsonRes(500, {})) // refresh: 5xx
      .mockResolvedValueOnce(jsonRes(500, {})) // exchange: 5xx — весь цикл транзиентный
      .mockResolvedValueOnce(okToken('recovered')); // второй цикл: refresh ok
    const promise = renewSession();
    await vi.advanceTimersByTimeAsync(REFRESH_RETRY_DELAYS_MS[0]);
    await expect(promise).resolves.toBe(true);
    expect(authHeaders().Authorization).toBe('Bearer recovered');
  });
});

describe('ensureSession', () => {
  it('стартовый обмен идёт один раз за загрузку приложения', async () => {
    fetchMock().mockResolvedValue(okToken());
    await Promise.all([ensureSession(), ensureSession()]);
    await ensureSession();
    expect(fetchMock()).toHaveBeenCalledTimes(1);
  });
});

describe('markSessionExpired', () => {
  it('стреляет событием — экран обязан сказать пользователю, а не молчать', () => {
    const onExpired = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    markSessionExpired();
    expect(onExpired).toHaveBeenCalledTimes(1);
    window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  });
});

// Регресс «постоянно нужно логиниться заново» (2026-08-21, пункт 3): после
// сна устройства/разрыва сети ничто не пыталось перевыпустить сессию само —
// только следующий явный 401 в середине действия пользователя.
describe('online/visibilitychange — перевыпуск после сна устройства', () => {
  it('событие online дёргает renewSession без ожидания следующего 401', async () => {
    fetchMock().mockResolvedValue(okToken('from-online'));
    window.dispatchEvent(new Event('online'));
    await vi.waitFor(() =>
      expect(authHeaders().Authorization).toBe('Bearer from-online'),
    );
  });

  it('возврат вкладки в видимость (visibilitychange) тоже дёргает renewSession', async () => {
    fetchMock().mockResolvedValue(okToken('from-visible'));
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.waitFor(() =>
      expect(authHeaders().Authorization).toBe('Bearer from-visible'),
    );
  });
});
