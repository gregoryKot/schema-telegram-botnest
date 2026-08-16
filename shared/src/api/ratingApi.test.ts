// @vitest-environment jsdom
// createRatingApi — контракт оффлайн-надёжности оценки (единственная копия
// для обоих фронтендов). Интеграция через webapp/api.test.ts уже есть; здесь
// сам примитив: успех — как есть, 4xx — бросок, сеть/5xx — в outbox с
// ответом-успехом, flushOutbox — доотправка очереди + outbox_flush.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRatingApi, HttpStatusError } from './ratingApi';

const authedFetch = vi.fn();
const trackEvent = vi.fn();

function makeApi() {
  return createRatingApi(authedFetch, trackEvent);
}

const okJson = (body: unknown) => ({
  ok: true,
  json: () => Promise.resolve(body),
});

beforeEach(() => {
  localStorage.clear();
  authedFetch.mockReset();
  trackEvent.mockReset();
});

describe('createRatingApi.saveRating', () => {
  it('успех — ответ сервера как есть', async () => {
    authedFetch.mockResolvedValue(
      okJson({ ok: true, allDone: true, streak: { current: 3 } }),
    );
    const res = await makeApi().saveRating('safety', 7, '2026-08-16');
    expect(res.allDone).toBe(true);
    const body = JSON.parse(
      (authedFetch.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body).toEqual({ needId: 'safety', value: 7, date: '2026-08-16' });
  });

  it('4xx — бросает HttpStatusError, в outbox НЕ кладёт', async () => {
    authedFetch.mockResolvedValue({ ok: false, status: 422 });
    await expect(makeApi().saveRating('safety', 7)).rejects.toThrow(
      HttpStatusError,
    );
    // Очередь пуста: флаш ничего не шлёт и событие не трекает.
    authedFetch.mockResolvedValue(okJson({ ok: true, allDone: false }));
    await makeApi().flushOutbox();
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('сетевой сбой — оценка в outbox, ответ успешен (дата зафиксирована)', async () => {
    authedFetch.mockRejectedValue(new Error('offline'));
    const res = await makeApi().saveRating('safety', 7, '2026-08-10');
    expect(res.ok).toBe(true);

    // Read-after-write: при следующем старте флаш шлёт отложенное с ТОЙ датой.
    authedFetch.mockReset();
    authedFetch.mockResolvedValue(okJson({ ok: true, allDone: false }));
    await makeApi().flushOutbox();
    const sent = JSON.parse(
      (authedFetch.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(sent).toEqual({ needId: 'safety', value: 7, date: '2026-08-10' });
    expect(trackEvent).toHaveBeenCalledWith('outbox_flush', { count: 1 });

    // Очередь очищена — второй флаш молчит.
    authedFetch.mockClear();
    trackEvent.mockClear();
    await makeApi().flushOutbox();
    expect(authedFetch).not.toHaveBeenCalled();
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('5xx — тоже оффлайн-путь (сервер упал ≠ пользователь виноват)', async () => {
    authedFetch.mockResolvedValue({ ok: false, status: 503 });
    const res = await makeApi().saveRating('care', 5);
    expect(res.ok).toBe(true);
  });
});
