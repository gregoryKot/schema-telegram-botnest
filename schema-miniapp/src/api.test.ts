// @vitest-environment jsdom
// Тесты api.ts (TEST_COVERAGE_PLAN.md, этап 2 п.9, остаток): API-клиент
// мини-аппа разошёлся с webapp/src/api.ts на ~113 строк (window.Telegram
// initData вместо Authorization: Bearer, нет credentials: 'include', и
// несколько ручек — deleteYsqProgress/deletePractice/deleteAllUserData/
// deleteYsqResult — переписаны через сырой fetch() вместо общих
// get/post/del хелперов, из-за чего у них нет fetchWithTimeout/AbortController
// и (у deleteAllUserData) захардкожен текст ошибки 'Failed' вместо статуса).
// Эта развилка нигде не тестировалась — фиксируем реальное поведение.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api } from './api';

function mockFetchOnce(status: number, body?: unknown) {
  const json = vi.fn().mockResolvedValue(body ?? {});
  const res = { ok: status >= 200 && status < 300, status, json };
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(res);
  return res;
}

beforeEach(() => {
  global.fetch = vi.fn();
  (window as unknown as { Telegram?: unknown }).Telegram = {
    WebApp: { initData: 'query_id=AAA&user=%7B%7D&hash=deadbeef' },
  };
});

afterEach(() => {
  vi.restoreAllMocks();
  delete (window as unknown as { Telegram?: unknown }).Telegram;
});

// ─── (a) auth-заголовки ──────────────────────────────────────────────────────
describe('api — заголовки авторизации', () => {
  it('GET-запрос несёт x-telegram-init-data из window.Telegram.WebApp.initData', async () => {
    mockFetchOnce(200, { accepted: true });
    await api.getDisclaimer();
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const headers = init.headers as Record<string, string>;
    expect(headers['x-telegram-init-data']).toBe(
      'query_id=AAA&user=%7B%7D&hash=deadbeef',
    );
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('нет Authorization-заголовка (в отличие от webapp — там Bearer-токен)', async () => {
    mockFetchOnce(200, { accepted: true });
    await api.getDisclaimer();
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it('нет window.Telegram.WebApp → initData подставляется пустой строкой, запрос не падает', async () => {
    delete (window as unknown as { Telegram?: unknown }).Telegram;
    mockFetchOnce(200, { accepted: true });
    await api.getDisclaimer();
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const headers = init.headers as Record<string, string>;
    expect(headers['x-telegram-init-data']).toBe('');
  });

  it('POST-запрос тоже несёт initData и Content-Type, тело — JSON', async () => {
    mockFetchOnce(200, {});
    await api.init(-180);
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ tzOffset: -180 });
    expect(
      (init.headers as Record<string, string>)['x-telegram-init-data'],
    ).toBe('query_id=AAA&user=%7B%7D&hash=deadbeef');
  });

  it('в fetch не передаётся credentials: include (в отличие от webapp)', async () => {
    mockFetchOnce(200, { accepted: true });
    await api.getDisclaimer();
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.credentials).toBeUndefined();
  });
});

// ─── (b) обработка ошибок для get/del (общий путь) ──────────────────────────
describe('api — ошибки: get/del бросают generic "API error: <status>"', () => {
  it('get() на не-ok статусе бросает "API error: 404", тело ответа не читается', async () => {
    mockFetchOnce(404, { message: 'not used' });
    await expect(api.getDisclaimer()).rejects.toThrow('API error: 404');
  });

  it('del() (leaveTherapy) на не-ok статусе бросает "API error: 500"', async () => {
    mockFetchOnce(500);
    await expect(api.leaveTherapy()).rejects.toThrow('API error: 500');
  });

  it('get() на ok-статусе возвращает распарсенный json', async () => {
    mockFetchOnce(200, { accepted: true });
    await expect(api.getDisclaimer()).resolves.toEqual({ accepted: true });
  });
});

// ─── (b) обработка ошибок для post/postJson — пытаются прочитать message ────
describe('api — ошибки: post/postJson читают {message} из тела ответа', () => {
  it('post() использует строковый message из JSON-тела как текст ошибки', async () => {
    mockFetchOnce(400, { message: 'нельзя дважды за день' });
    await expect(api.recordActivity()).rejects.toThrow('нельзя дважды за день');
  });

  it('post() сериализует нестроковый message через JSON.stringify', async () => {
    mockFetchOnce(422, { message: { field: 'text', code: 'too_long' } });
    await expect(api.recordActivity()).rejects.toThrow(
      JSON.stringify({ field: 'text', code: 'too_long' }),
    );
  });

  it('post() при нечитаемом/пустом теле откатывается на "API error: <status>"', async () => {
    const res = {
      ok: false,
      status: 503,
      json: vi.fn().mockRejectedValue(new Error('not json')),
    };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(res);
    await expect(api.recordActivity()).rejects.toThrow('API error: 503');
  });

  it('postJson() успешно возвращает тело как есть', async () => {
    mockFetchOnce(200, { ok: true });
    await expect(api.updateName('Аня')).resolves.toEqual({ ok: true });
  });
});

// ─── (c) fetchWithTimeout: AbortController/сигнал только у стандартных хелперов
describe('api — таймаут: fetchWithTimeout передаёт AbortSignal', () => {
  it('get/post/del идут через fetchWithTimeout — в init есть signal', async () => {
    mockFetchOnce(200, {});
    await api.recordActivity();
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('fetchWithTimeout реально абортит запрос по истечении 15 секунд', async () => {
    vi.useFakeTimers();
    let capturedSignal: AbortSignal | undefined;
    global.fetch = vi.fn((_url: string, init?: RequestInit) => {
      capturedSignal = init?.signal as AbortSignal;
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new Error('aborted'));
        });
      });
    }) as typeof fetch;
    const pending = api.getDisclaimer();
    pending.catch(() => {});
    await vi.advanceTimersByTimeAsync(15000);
    expect(capturedSignal?.aborted).toBe(true);
    vi.useRealTimers();
  });
});

// ─── (d) миниапп-специфичная развилка: ручки на сыром fetch без таймаута ────
describe('api — ручки на сыром fetch (deleteYsqProgress/deletePractice/deleteAllUserData/deleteYsqResult)', () => {
  it('deleteYsqProgress НЕ передаёт signal (в обход fetchWithTimeout, в отличие от webapp del())', async () => {
    mockFetchOnce(200, {});
    await api.deleteYsqProgress();
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.signal).toBeUndefined();
  });

  it('deleteYsqProgress на не-ok бросает "API error: <status>"', async () => {
    mockFetchOnce(404);
    await expect(api.deleteYsqProgress()).rejects.toThrow('API error: 404');
  });

  it('deletePractice на не-ok бросает "API error: <status>", тело ответа не читается', async () => {
    mockFetchOnce(403, { message: 'игнорируется' });
    await expect(api.deletePractice(5)).rejects.toThrow('API error: 403');
  });

  it('deleteAllUserData на не-ok бросает захардкоженный "Failed" (НЕ статус-специфичный текст)', async () => {
    mockFetchOnce(500, { message: 'что угодно' });
    await expect(api.deleteAllUserData()).rejects.toThrow('Failed');
  });

  it('deleteYsqResult на не-ok бросает "API error: <status>"', async () => {
    mockFetchOnce(401);
    await expect(api.deleteYsqResult()).rejects.toThrow('API error: 401');
  });

  it('успешный deletePractice не бросает и не требует тела ответа', async () => {
    mockFetchOnce(204);
    await expect(api.deletePractice(1)).resolves.toBeUndefined();
  });
});

// ─── (d) саморучные ручки с телом ответа: saveRating/createPairInvite/leavePair
describe('api — ручки с ручным fetch, возвращающие данные', () => {
  it('saveRating отправляет needId/value/date и возвращает json на успехе', async () => {
    mockFetchOnce(200, { ok: true, allDone: false });
    const result = await api.saveRating('safety', 7, '2026-07-16');
    expect(result).toEqual({ ok: true, allDone: false });
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse(init.body as string)).toEqual({
      needId: 'safety',
      value: 7,
      date: '2026-07-16',
    });
  });

  it('saveRating на не-ok бросает "API error: <status>"', async () => {
    mockFetchOnce(400);
    await expect(api.saveRating('safety', 7)).rejects.toThrow('API error: 400');
  });

  it('createPairInvite возвращает {code, url} и шлёт пустое JSON-тело', async () => {
    mockFetchOnce(200, { code: 'ABC123', url: 'https://t.me/x' });
    const result = await api.createPairInvite();
    expect(result).toEqual({ code: 'ABC123', url: 'https://t.me/x' });
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.body).toBe('{}');
  });

  it('leavePair шлёт code в теле DELETE-запроса', async () => {
    mockFetchOnce(200, {});
    await api.leavePair('ABC123');
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.method).toBe('DELETE');
    expect(JSON.parse(init.body as string)).toEqual({ code: 'ABC123' });
  });

  it('leavePair на не-ok бросает "API error: <status>"', async () => {
    mockFetchOnce(409);
    await expect(api.leavePair('ABC123')).rejects.toThrow('API error: 409');
  });
});

// ─── query-параметры: querystring собирается только когда аргумент задан ────
describe('api — построение querystring (ratings/history/planHistory)', () => {
  it('ratings() без даты не добавляет ?date=', async () => {
    mockFetchOnce(200, {});
    await api.ratings();
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('/api/ratings');
  });

  it('ratings(date) кодирует дату в querystring', async () => {
    mockFetchOnce(200, {});
    await api.ratings('2026-07-16');
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('/api/ratings?date=2026-07-16');
  });

  it('history() без аргумента использует дефолт days=7', async () => {
    mockFetchOnce(200, []);
    await api.history();
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('/api/history?days=7');
  });

  it('getPlanHistory() без аргумента использует дефолт days=30', async () => {
    mockFetchOnce(200, []);
    await api.getPlanHistory();
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('/api/plans/history?days=30');
  });
});
