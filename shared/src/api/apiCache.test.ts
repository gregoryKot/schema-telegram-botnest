// Контракт кеша GET-ответов (apiCache.ts) — дедуп, stale-while-revalidate,
// инвалидация, полная очистка при смене userId. Время двигаем через
// vi.spyOn(Date, 'now') (в модуле нет setTimeout — реальные таймеры не
// участвуют), фоновые промисы дочищаем реальным `flush()`.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  cachedGet,
  invalidate,
  clearApiCache,
  subscribe,
  isCacheableGetPath,
  API_CACHE_FRESH_MS,
  API_CACHE_STALE_MS,
} from './apiCache';

let now = 1_700_000_000_000;
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  now = 1_700_000_000_000;
  vi.spyOn(Date, 'now').mockImplementation(() => now);
  clearApiCache();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('дедупликация одновременных GET', () => {
  it('два одновременных вызова на один ключ — одна сетевая попытка', async () => {
    let calls = 0;
    const fetcher = () => {
      calls++;
      return Promise.resolve({ n: calls });
    };
    const [a, b] = await Promise.all([
      cachedGet('/api/x', fetcher),
      cachedGet('/api/x', fetcher),
    ]);
    expect(calls).toBe(1);
    expect(a).toEqual(b);
  });

  it('ошибка сети не залипает — следующий вызов пробует снова', async () => {
    let attempt = 0;
    const fetcher = () => {
      attempt++;
      return attempt === 1
        ? Promise.reject(new Error('net'))
        : Promise.resolve('ok');
    };
    await expect(cachedGet('/api/y', fetcher)).rejects.toThrow('net');
    await expect(cachedGet('/api/y', fetcher)).resolves.toBe('ok');
    expect(attempt).toBe(2);
  });
});

describe('fresh/stale', () => {
  it('свежая запись не ходит в сеть', async () => {
    const fetcher = vi.fn(() => Promise.resolve('v1'));
    await cachedGet('/api/streak', fetcher);
    now += API_CACHE_FRESH_MS - 1000;
    const v = await cachedGet('/api/streak', fetcher);
    expect(v).toBe('v1');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('протухшая (stale) отдаёт старое немедленно И обновляет подписчика', async () => {
    let value = 'v1';
    const fetcher = vi.fn(() => Promise.resolve(value));
    await cachedGet('/api/streak', fetcher);

    const seen: string[] = [];
    subscribe<string>('/api/streak', (d) => seen.push(d));

    now += API_CACHE_FRESH_MS + 1000; // ушли во stale-окно
    value = 'v2';
    const immediate = await cachedGet('/api/streak', fetcher);
    expect(immediate).toBe('v1'); // немедленно старое

    await flush();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(seen).toEqual(['v2']); // подписчик узнал о свежих данных

    const next = await cachedGet('/api/streak', fetcher);
    expect(next).toBe('v2'); // следующий вызов уже видит обновлённое
  });

  it('отписка останавливает уведомления', async () => {
    let value = 'v1';
    const fetcher = vi.fn(() => Promise.resolve(value));
    await cachedGet('/api/streak', fetcher);

    const seen: string[] = [];
    const unsubscribe = subscribe<string>('/api/streak', (d) => seen.push(d));
    unsubscribe();

    now += API_CACHE_FRESH_MS + 1000;
    value = 'v2';
    await cachedGet('/api/streak', fetcher);
    await flush();

    expect(seen).toEqual([]); // отписался — уведомление не долетело
  });

  it('ошибка фонового обновления не стирает уже показанные данные', async () => {
    let fail = false;
    const fetcher = vi.fn(() =>
      fail ? Promise.reject(new Error('net down')) : Promise.resolve('v1'),
    );
    await cachedGet('/api/streak', fetcher);

    now += API_CACHE_FRESH_MS + 1000;
    fail = true;
    const duringFailure = await cachedGet('/api/streak', fetcher);
    expect(duringFailure).toBe('v1');

    await flush();
    expect(fetcher).toHaveBeenCalledTimes(2);
    // Кеш не стёрт ошибкой — следующий вызов (ещё в пределах stale) видит те же данные.
    const after = await cachedGet('/api/streak', fetcher);
    expect(after).toBe('v1');
  });

  it('за пределами stale — обычный запрос в сеть', async () => {
    const fetcher = vi.fn(() => Promise.resolve('v1'));
    await cachedGet('/api/streak', fetcher);
    now += API_CACHE_STALE_MS + 1000;
    await cachedGet('/api/streak', fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe('инвалидация', () => {
  it('сбрасывает нужный ключ и НЕ трогает посторонний', async () => {
    const a = vi.fn(() => Promise.resolve('a1'));
    const b = vi.fn(() => Promise.resolve('b1'));
    await cachedGet('/api/settings', a);
    await cachedGet('/api/profile', b);

    invalidate(['/api/settings']);

    await cachedGet('/api/settings', a); // перезапрос — кеш сброшен
    await cachedGet('/api/profile', b); // всё ещё свежий, сети не трогает
    expect(a).toHaveBeenCalledTimes(2);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('префикс сбрасывает все варианты query, но не посторонний ключ', async () => {
    const f = vi.fn(() => Promise.resolve('v'));
    await cachedGet('/api/history?days=7', f);
    await cachedGet('/api/history?days=112', f);
    await cachedGet('/api/streak', f);

    invalidate([{ prefix: '/api/history' }]);

    await cachedGet('/api/history?days=7', f);
    await cachedGet('/api/history?days=112', f);
    await cachedGet('/api/streak', f);
    // 3 первых + 2 пере-сходивших history = 5; streak остался свежим (не 6-й вызов).
    expect(f).toHaveBeenCalledTimes(5);
  });
});

describe('логаут / смена пользователя', () => {
  it('clearApiCache стирает всё — следующий вызов идёт в сеть', async () => {
    const f = vi.fn(() => Promise.resolve('v'));
    await cachedGet('/api/settings', f);
    await cachedGet('/api/profile', f);
    clearApiCache();
    await cachedGet('/api/settings', f);
    await cachedGet('/api/profile', f);
    expect(f).toHaveBeenCalledTimes(4);
  });
});

describe('isCacheableGetPath', () => {
  it('/api/auth/* и /health исключены', () => {
    expect(isCacheableGetPath('/api/auth/refresh')).toBe(false);
    expect(isCacheableGetPath('/health')).toBe(false);
    expect(isCacheableGetPath('/health/db')).toBe(false);
  });

  it('обычные пользовательские GET кешируемы', () => {
    expect(isCacheableGetPath('/api/streak')).toBe(true);
    expect(isCacheableGetPath('/api/booking/by-token/abc')).toBe(true);
  });
});

// Гонка «ответ пришёл после того, как его отменили». Без поколений (см.
// комментарий в apiCache.ts) долетевший ответ писался в кеш независимо от
// того, что успело произойти, пока он летел — и жил дальше как свежий.
describe('поколения: ответ, устаревший ещё в полёте', () => {
  it('мутация во время запроса — до-мутационный ответ НЕ оседает в кеше', async () => {
    let resolveFetch: (v: { v: string }) => void = () => {};
    let calls = 0;
    const slow = () => {
      calls++;
      return new Promise<{ v: string }>((r) => {
        resolveFetch = r;
      });
    };

    const inFlight = cachedGet('/api/note', slow);
    // Пока запрос летит, пользователь сохранил новое значение.
    invalidate(['/api/note']);
    resolveFetch({ v: 'до сохранения' });
    await inFlight;
    await flush();

    // Следующее чтение обязано пойти в сеть, а не отдать до-мутационное.
    const fresh = await cachedGet('/api/note', () =>
      Promise.resolve({ v: 'после сохранения' }),
    );
    expect(fresh).toEqual({ v: 'после сохранения' });
    expect(calls).toBe(1);
  });

  it('инвалидация по префиксу достаёт и до ещё летящего запроса', async () => {
    let resolveFetch: (v: string) => void = () => {};
    const slow = () =>
      new Promise<string>((r) => {
        resolveFetch = r;
      });

    const inFlight = cachedGet('/api/practices?needId=safety', slow);
    invalidate([{ prefix: '/api/practices' }]);
    resolveFetch('старое');
    await inFlight;
    await flush();

    const fresh = await cachedGet('/api/practices?needId=safety', () =>
      Promise.resolve('новое'),
    );
    expect(fresh).toBe('новое');
  });

  it('логаут во время запроса — данные прошлого пользователя не оседают', async () => {
    let resolveFetch: (v: string) => void = () => {};
    const slow = () =>
      new Promise<string>((r) => {
        resolveFetch = r;
      });

    const inFlight = cachedGet('/api/settings', slow);
    clearApiCache();
    resolveFetch('данные прошлого пользователя');
    await inFlight;
    await flush();

    const fresh = await cachedGet('/api/settings', () =>
      Promise.resolve('данные нового пользователя'),
    );
    expect(fresh).toBe('данные нового пользователя');
  });

  it('подписчик не получает уведомление об отменённом ответе', async () => {
    let resolveFetch: (v: string) => void = () => {};
    const slow = () =>
      new Promise<string>((r) => {
        resolveFetch = r;
      });
    const seen: string[] = [];
    subscribe<string>('/api/insights', (d) => seen.push(d));

    const inFlight = cachedGet('/api/insights', slow);
    invalidate(['/api/insights']);
    resolveFetch('отменённое');
    await inFlight;
    await flush();

    expect(seen).toEqual([]);
  });

  it('вызывающий код всё равно получает свой ответ — отменяется запись, не запрос', async () => {
    let resolveFetch: (v: string) => void = () => {};
    const slow = () =>
      new Promise<string>((r) => {
        resolveFetch = r;
      });

    const inFlight = cachedGet('/api/streak', slow);
    invalidate(['/api/streak']);
    resolveFetch('ответ');
    await expect(inFlight).resolves.toBe('ответ');
  });

  it('запрос, стартовавший ПОСЛЕ инвалидации, кешируется как обычно', async () => {
    let calls = 0;
    const fetcher = () => {
      calls++;
      return Promise.resolve(calls);
    };
    await cachedGet('/api/streak', fetcher);
    invalidate(['/api/streak']);
    await cachedGet('/api/streak', fetcher);
    await cachedGet('/api/streak', fetcher);
    expect(calls).toBe(2);
  });
});
