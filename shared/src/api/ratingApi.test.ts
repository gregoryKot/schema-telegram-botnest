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

  it('шлёт POST на /api/rating (не любой путь/метод)', async () => {
    authedFetch.mockResolvedValue(okJson({ ok: true, allDone: false }));
    await makeApi().saveRating('safety', 5, '2026-08-16');
    expect(authedFetch.mock.calls[0][0]).toBe('/api/rating');
    expect((authedFetch.mock.calls[0][1] as RequestInit).method).toBe('POST');
  });

  it('HttpStatusError.message содержит код ответа (виден в логах)', async () => {
    authedFetch.mockResolvedValue({ ok: false, status: 418 });
    await expect(makeApi().saveRating('safety', 5)).rejects.toThrow(
      'API error: 418',
    );
  });
});

describe('createRatingApi.saveRating — границы классификации 4xx/5xx', () => {
  // isClientError смотрит на диапазон [400, 500) — четыре теста ниже бьют
  // именно по границам этого диапазона и по условию instanceof, а не по
  // «типичным» кодам вроде 422/503, которые уже были покрыты выше и не
  // ловят мутации операторов сравнения (>= → >, < → <=) на самой границе.
  it('статус 399 (ниже границы 4xx) — уходит в outbox, не бросает', async () => {
    authedFetch.mockResolvedValue({ ok: false, status: 399 });
    const res = await makeApi().saveRating('safety', 5);
    expect(res.ok).toBe(true);
  });

  it('статус 400 (нижняя граница 4xx включительно) — бросает', async () => {
    authedFetch.mockResolvedValue({ ok: false, status: 400 });
    await expect(makeApi().saveRating('safety', 5)).rejects.toThrow(
      HttpStatusError,
    );
  });

  it('статус 500 (нижняя граница 5xx, уже не клиентская) — уходит в outbox с allDone:false', async () => {
    authedFetch.mockResolvedValue({ ok: false, status: 500 });
    const res = await makeApi().saveRating('safety', 5);
    expect(res.ok).toBe(true);
    expect(res.allDone).toBe(false);
  });

  it('ошибка не instanceof HttpStatusError со «случайным» полем status — всё равно в outbox', async () => {
    // Сетевые/таймаут-ошибки — обычные Error без .status, но если у ошибки
    // случайно окажется числовое поле status (например, чужой класс ошибки
    // из другого модуля) — классификация обязана идти по instanceof, а не
    // по наличию поля.
    class FakeStatusError extends Error {
      status = 499;
    }
    authedFetch.mockRejectedValue(new FakeStatusError('boom'));
    const res = await makeApi().saveRating('safety', 5);
    expect(res.ok).toBe(true);
  });
});
