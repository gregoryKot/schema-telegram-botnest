// @vitest-environment jsdom
// Тест оффлайн-очереди оценок (правило №3 — перенесено из
// удалённого мини-аппа, единственная копия теперь здесь;
// webapp получает тот же контракт через webapp/src/apiRating.ts). Реальный
// jsdom-localStorage — тот же паттерн, что у drafts.test.ts в этом каталоге.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  enqueueRating,
  flushRatingOutbox,
  pendingRatingsFor,
  type OutboxItem,
} from './ratingOutbox';

const OUTBOX_KEY = 'rating_outbox_v1';

beforeEach(() => {
  localStorage.clear();
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

  it('не трогает localStorage лишний раз, если очередь и так пуста (нет мусорного removeItem)', async () => {
    // Ранний выход по пустой очереди обязан быть именно ранним — а не
    // «дойти до writeOutbox([]) и получить тот же результат окольным путём».
    // Различимо только через шпион на сам вызов removeItem.
    const removeSpy = vi.spyOn(Storage.prototype, 'removeItem');
    const post = vi.fn().mockResolvedValue(undefined);
    await flushRatingOutbox(post);
    expect(removeSpy).not.toHaveBeenCalled();
    removeSpy.mockRestore();
  });
});

// QA 2026-11-03, З9: экран дня кладёт очередь поверх ответа сервера.
describe('pendingRatingsFor', () => {
  it('оценки только этого дня, последнее значение побеждает', () => {
    enqueueRating(item('safety', 3, '2026-07-17'));
    enqueueRating(item('play', 6, '2026-07-16'));
    enqueueRating(item('safety', 8, '2026-07-17'));
    expect(pendingRatingsFor('2026-07-17')).toEqual({ safety: 8 });
    expect(pendingRatingsFor('2026-07-16')).toEqual({ play: 6 });
  });

  it('пустая очередь — пусто', () => {
    expect(pendingRatingsFor('2026-07-17')).toEqual({});
  });

  it('после выгрузки очередь пуста — снимок до чтения не теряет ни одной оценки', async () => {
    enqueueRating(item('safety', 8, '2026-07-17'));
    const snapshot = pendingRatingsFor('2026-07-17');
    await flushRatingOutbox(() => Promise.resolve());
    expect(snapshot).toEqual({ safety: 8 });
    expect(pendingRatingsFor('2026-07-17')).toEqual({});
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

  // Три теста ниже бьют по каждому полю isOutboxItem отдельно (мутационная
  // закалка 2026-08-16): запись с ВСЕМИ корректными полями, кроме одного,
  // обязана отбрасываться целиком — иначе, например, {needId: 123, ...}
  // проскочит в очередь и упадёт на сервере с непонятной 400-кой.
  it('отбрасывает запись, где needId не строка (остальные поля валидны)', () => {
    localStorage.setItem(
      OUTBOX_KEY,
      JSON.stringify([{ needId: 123, value: 5, date: '2026-01-01' }]),
    );
    enqueueRating(item('safety', 1, '2026-01-02'));
    const raw = JSON.parse(localStorage.getItem(OUTBOX_KEY)!);
    expect(raw).toEqual([item('safety', 1, '2026-01-02')]);
  });

  it('отбрасывает запись, где value не число (остальные поля валидны)', () => {
    localStorage.setItem(
      OUTBOX_KEY,
      JSON.stringify([{ needId: 'safety', value: '5', date: '2026-01-01' }]),
    );
    enqueueRating(item('autonomy', 2, '2026-01-02'));
    const raw = JSON.parse(localStorage.getItem(OUTBOX_KEY)!);
    expect(raw).toEqual([item('autonomy', 2, '2026-01-02')]);
  });

  it('отбрасывает запись, где date не строка (остальные поля валидны)', () => {
    localStorage.setItem(
      OUTBOX_KEY,
      JSON.stringify([{ needId: 'safety', value: 5, date: 20260101 }]),
    );
    enqueueRating(item('play', 3, '2026-01-02'));
    const raw = JSON.parse(localStorage.getItem(OUTBOX_KEY)!);
    expect(raw).toEqual([item('play', 3, '2026-01-02')]);
  });
});

// Аудит 2026-11, E3: выгрузка писала в очередь «хвост по счёту» от снимка до
// начала — оценка, поставленная во время выгрузки, стиралась; старт и событие
// `online` запускали две выгрузки параллельно, и оценки уходили дважды.
describe('flushRatingOutbox — гонки', () => {
  it('оценка, поставленная во время выгрузки, остаётся в очереди', async () => {
    enqueueRating(item('safety', 4, '2026-07-17'));
    const post = vi.fn(async () => {
      // Пока первый POST в пути, человек ставит ещё две оценки (сеть упала).
      enqueueRating(item('play', 6, '2026-07-17'));
      enqueueRating(item('safety', 8, '2026-07-17'));
    });
    await flushRatingOutbox(post);
    expect(post).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem(OUTBOX_KEY)!)).toEqual([
      item('play', 6, '2026-07-17'),
      item('safety', 8, '2026-07-17'),
    ]);
    expect(pendingRatingsFor('2026-07-17')).toEqual({ play: 6, safety: 8 });
  });

  it('две выгрузки сразу — один POST на оценку', async () => {
    enqueueRating(item('safety', 4, '2026-07-17'));
    enqueueRating(item('play', 6, '2026-07-17'));
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const post = vi.fn(() => gate);
    const first = flushRatingOutbox(post);
    const second = flushRatingOutbox(post);
    release();
    await Promise.all([first, second]);
    expect(post).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem(OUTBOX_KEY)).toBeNull();
  });

  it('после выгрузки замок снят — следующая выгрузка идёт заново', async () => {
    enqueueRating(item('safety', 4, '2026-07-17'));
    await flushRatingOutbox(() => Promise.reject(new TypeError('offline')));
    const post = vi.fn().mockResolvedValue(undefined);
    await flushRatingOutbox(post);
    expect(post).toHaveBeenCalledWith(item('safety', 4, '2026-07-17'));
  });
});

describe('хранилище недоступно', () => {
  it('enqueueRating говорит false — оценку положить некуда', () => {
    const spy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new DOMException('quota', 'QuotaExceededError');
      });
    try {
      expect(enqueueRating(item('safety', 5, '2026-07-17'))).toBe(false);
    } finally {
      spy.mockRestore();
    }
    expect(enqueueRating(item('safety', 5, '2026-07-17'))).toBe(true);
  });
});
