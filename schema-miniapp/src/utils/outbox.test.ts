// Тест оффлайн-очереди оценок (этап 3, финальный пункт — см. api.ts
// saveRating/flushOutbox). Чистые функции, без jsdom — localStorage
// замокан обычным объектом.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { enqueueRating, flushRatingOutbox, OutboxItem } from './outbox';
import { createLocalStorageMock } from './localStorageMock';

const OUTBOX_KEY = 'rating_outbox_v1';

beforeEach(() => {
  (globalThis as any).localStorage = createLocalStorageMock();
});

const item = (needId: string, value: number, date: string): OutboxItem => ({
  needId,
  value,
  date,
});

describe('enqueueRating', () => {
  it('добавляет элемент в пустую очередь', () => {
    enqueueRating(item('safety', 5, '2026-07-17'));
    const raw = localStorage.getItem(OUTBOX_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!)).toEqual([item('safety', 5, '2026-07-17')]);
  });

  it('накапливает несколько элементов по порядку', () => {
    enqueueRating(item('safety', 1, '2026-07-15'));
    enqueueRating(item('autonomy', 2, '2026-07-16'));
    const raw = JSON.parse(localStorage.getItem(OUTBOX_KEY)!);
    expect(raw).toEqual([
      item('safety', 1, '2026-07-15'),
      item('autonomy', 2, '2026-07-16'),
    ]);
  });

  it('вытесняет старые элементы при превышении лимита 200', () => {
    for (let i = 0; i < 205; i++) {
      enqueueRating(
        item(
          'safety',
          i % 10,
          `2026-01-${String((i % 28) + 1).padStart(2, '0')}`,
        ),
      );
    }
    const raw = JSON.parse(localStorage.getItem(OUTBOX_KEY)!);
    expect(raw.length).toBe(200);
    // Первые 5 (i=0..4) должны были быть вытеснены — остался элемент с i=5.
    expect(raw[0].value).toBe(5 % 10);
  });
});

describe('flushRatingOutbox', () => {
  it('ничего не делает на пустой очереди', async () => {
    const post = vi.fn().mockResolvedValue(undefined);
    await flushRatingOutbox(post);
    expect(post).not.toHaveBeenCalled();
  });

  it('дедуплицирует по (needId, date), побеждает последняя запись', async () => {
    enqueueRating(item('safety', 1, '2026-07-17'));
    enqueueRating(item('safety', 9, '2026-07-17')); // тот же ключ, новое значение
    enqueueRating(item('autonomy', 3, '2026-07-17'));

    const post = vi.fn().mockResolvedValue(undefined);
    await flushRatingOutbox(post);

    expect(post).toHaveBeenCalledTimes(2);
    expect(post).toHaveBeenNthCalledWith(1, item('safety', 9, '2026-07-17'));
    expect(post).toHaveBeenNthCalledWith(2, item('autonomy', 3, '2026-07-17'));
    expect(localStorage.getItem(OUTBOX_KEY)).toBeNull();
  });

  it('останавливается на первой ошибке, оставляя хвост в очереди', async () => {
    enqueueRating(item('safety', 1, '2026-07-15'));
    enqueueRating(item('autonomy', 2, '2026-07-16'));
    enqueueRating(item('play', 3, '2026-07-17'));

    const post = vi
      .fn()
      .mockResolvedValueOnce(undefined) // safety — ок
      .mockRejectedValueOnce(new TypeError('Failed to fetch')); // autonomy — сеть легла

    await flushRatingOutbox(post);

    // play не должен был даже попытаться отправиться.
    expect(post).toHaveBeenCalledTimes(2);
    const raw = JSON.parse(localStorage.getItem(OUTBOX_KEY)!);
    expect(raw).toEqual([
      item('autonomy', 2, '2026-07-16'),
      item('play', 3, '2026-07-17'),
    ]);
  });

  it('удаляет все успешно отправленные элементы', async () => {
    enqueueRating(item('safety', 1, '2026-07-15'));
    enqueueRating(item('autonomy', 2, '2026-07-16'));

    const post = vi.fn().mockResolvedValue(undefined);
    await flushRatingOutbox(post);

    expect(post).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem(OUTBOX_KEY)).toBeNull();
  });

  it('onRecovered зовётся с числом реально доехавших (для аналитики)', async () => {
    enqueueRating(item('safety', 1, '2026-07-15'));
    enqueueRating(item('autonomy', 2, '2026-07-16'));

    const post = vi.fn().mockResolvedValue(undefined);
    const onRecovered = vi.fn();
    await flushRatingOutbox(post, onRecovered);

    expect(onRecovered).toHaveBeenCalledTimes(1);
    expect(onRecovered).toHaveBeenCalledWith(2);
  });

  it('onRecovered НЕ зовётся, если ничего не доехало', async () => {
    enqueueRating(item('safety', 1, '2026-07-15'));
    const post = vi.fn().mockRejectedValue(new TypeError('offline'));
    const onRecovered = vi.fn();
    await flushRatingOutbox(post, onRecovered);

    expect(onRecovered).not.toHaveBeenCalled();
  });
});

describe('битый JSON в localStorage', () => {
  it('тихий сброс очереди вместо краша при enqueue', () => {
    localStorage.setItem(OUTBOX_KEY, '{not valid json');
    expect(() => enqueueRating(item('safety', 5, '2026-07-17'))).not.toThrow();
    const raw = JSON.parse(localStorage.getItem(OUTBOX_KEY)!);
    expect(raw).toEqual([item('safety', 5, '2026-07-17')]);
  });

  it('тихий сброс очереди вместо краша при flush', async () => {
    localStorage.setItem(OUTBOX_KEY, '"not an array"');
    const post = vi.fn().mockResolvedValue(undefined);
    await expect(flushRatingOutbox(post)).resolves.toBeUndefined();
    expect(post).not.toHaveBeenCalled();
  });

  it('фильтрует элементы неправильной формы, сохраняя валидные', () => {
    localStorage.setItem(
      OUTBOX_KEY,
      JSON.stringify([
        item('safety', 5, '2026-07-17'),
        { needId: 'autonomy' }, // битый — нет value/date
        null,
        item('play', 3, '2026-07-16'),
      ]),
    );
    enqueueRating(item('connection', 7, '2026-07-18'));
    const raw = JSON.parse(localStorage.getItem(OUTBOX_KEY)!);
    expect(raw).toEqual([
      item('safety', 5, '2026-07-17'),
      item('play', 3, '2026-07-16'),
      item('connection', 7, '2026-07-18'),
    ]);
  });
});
