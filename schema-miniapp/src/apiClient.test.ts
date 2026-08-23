// @vitest-environment jsdom
// Инцидент 2026-07-29: истёкшая initData → 401 на КАЖДЫЙ запрос, и приложение
// молча переставало работать (все вызовы обёрнуты в .catch(() => {})).
// Здесь проверяем связку «401 → перевыпуск сессии → повтор», включая случай,
// когда чинить нечем: тогда экран обязан узнать об этом событием.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get, post } from './apiClient';
import { clearSession, SESSION_EXPIRED_EVENT } from './session';
import { REFRESH_RETRY_DELAYS_MS } from '../../shared/src/auth/sessionRefresh';
import { clearApiCache } from '../../shared/src/api/apiCache';

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
  // Кеш GET-ответов (apiCache.ts) — модуль-синглтон; без сброса повторный
  // get('/api/disclaimer') отвечал бы из кеша предыдущего теста.
  clearApiCache();
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

  // Регресс «постоянно нужно логиниться заново» (диагностика 2026-08-21):
  // исходный запрос 401 (access-токен истёк), но сам refresh-эндпоинт
  // отвечает 500/сетевой ошибкой — временная беда инфры, а не невалидный
  // refresh-токен. Раньше это трактовалось одинаково с 401/403 от refresh, и
  // LoginScreen показывался при живой 30-дневной куке.
  it('refresh падает с 500 (не 401/403) → сессия остаётся живой, LoginScreen НЕ показывается', async () => {
    vi.useFakeTimers();
    const onExpired = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);

    fetchMock()
      .mockResolvedValueOnce(jsonRes(401, {})) // исходный GET: токен истёк
      .mockResolvedValue(jsonRes(500, {})); // refresh И exchange — 5xx

    const promise = get('/api/disclaimer');
    // Подписываемся на rejection СРАЗУ (до продвижения таймеров) — иначе
    // промис отклоняется раньше, чем на него повесят обработчик, и vitest
    // ловит его как unhandled rejection.
    const assertion = expect(promise).rejects.toThrow('API error: 401');
    for (const ms of REFRESH_RETRY_DELAYS_MS) {
      await vi.advanceTimersByTimeAsync(ms);
    }
    await assertion;
    expect(onExpired).not.toHaveBeenCalled();
    window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
    vi.useRealTimers();
  });

  it('refresh падает по сети (fetch throws) → тоже не считается истёкшей сессией', async () => {
    vi.useFakeTimers();
    const onExpired = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);

    fetchMock()
      .mockResolvedValueOnce(jsonRes(401, {}))
      .mockRejectedValue(new TypeError('offline'));

    const promise = get('/api/disclaimer');
    // Подписываемся на rejection СРАЗУ (до продвижения таймеров) — иначе
    // промис отклоняется раньше, чем на него повесят обработчик, и vitest
    // ловит его как unhandled rejection.
    const assertion = expect(promise).rejects.toThrow('API error: 401');
    for (const ms of REFRESH_RETRY_DELAYS_MS) {
      await vi.advanceTimersByTimeAsync(ms);
    }
    await assertion;
    expect(onExpired).not.toHaveBeenCalled();
    window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
    vi.useRealTimers();
  });
});

// «В Телеграме летает, из ярлыка долго» (2026-08-23): у веб-хоста (PWA/
// вкладка) authHeaders() пуст, и до фикса каждый запрос холодного старта
// ходил кругом 401 → общий refresh → повтор — весь залп по два раза.
// Теперь authedFetch без мгновенной авторизации сначала ждёт ОДИН общий
// обмен куки (ensureSession) и уходит сразу с Bearer.
describe('веб-хост (PWA): обмен куки ДО первого запроса', () => {
  beforeEach(() => {
    delete (window as unknown as { Telegram?: unknown }).Telegram;
  });

  it('без токена сначала /api/auth/refresh, затем запрос сразу с Bearer', async () => {
    fetchMock()
      .mockResolvedValueOnce(
        jsonRes(200, { accessToken: 'tok-pwa', expiresIn: 900 }),
      )
      .mockResolvedValueOnce(jsonRes(200, { accepted: true }));

    await expect(
      get<{ accepted: boolean }>('/api/disclaimer'),
    ).resolves.toEqual({ accepted: true });
    expect(urls()).toEqual(['/api/auth/refresh', '/api/disclaimer']);
    const [, init] = fetchMock().mock.calls[1] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer tok-pwa',
    );
  });

  it('параллельный залп делит ОДИН обмен — не по обмену на запрос', async () => {
    global.fetch = vi.fn((url: unknown) =>
      Promise.resolve(
        String(url) === '/api/auth/refresh'
          ? jsonRes(200, { accessToken: 'tok', expiresIn: 900 })
          : jsonRes(200, {}),
      ),
    );

    await Promise.all([
      get('/api/needs'),
      get('/api/ratings'),
      get('/api/settings'),
    ]);

    expect(urls().filter((u) => u === '/api/auth/refresh')).toHaveLength(1);
    // Обмен ушёл раньше любого запроса данных — залп его дождался.
    expect(urls()[0]).toBe('/api/auth/refresh');
    // Ни один запрос данных не получил 401 и не ходил дважды.
    expect(urls().filter((u) => u === '/api/needs')).toHaveLength(1);
  });

  it('кука мертва: запрос всё равно уходит, и экран узнаёт о смерти сессии', async () => {
    const listener = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, listener);
    global.fetch = vi.fn(() => Promise.resolve(jsonRes(401, {})));

    await expect(get('/api/needs')).rejects.toThrow();
    // Запрос данных отправлен (деградация, не вечное ожидание обмена).
    expect(urls()).toContain('/api/needs');
    expect(listener).toHaveBeenCalled();
    window.removeEventListener(SESSION_EXPIRED_EVENT, listener);
  });
});
