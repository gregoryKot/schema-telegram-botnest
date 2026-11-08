// Офлайн-надёжность оценки потребности — единственная реализация (правило №3;
// до 2026-08 сайт глушил сетевой сбой, и оценка терялась без следа).
// Транспорт (authedFetch/trackEvent) приходит снаружи.
import type { StreakData } from '../apiTypes';
import {
  type OutboxItem,
  enqueueRating,
  flushRatingOutbox,
} from '../utils/ratingOutbox';
import { todayStr } from '../utils/format';

export type SaveRatingResult = {
  ok: boolean;
  allDone: boolean;
  streak?: StreakData;
  /** Сервер не принял — оценка ждёт в outbox (QA B-З9: экран молчал, что она не ушла). */
  queued?: boolean;
};

// Статус ответа сервера (не сетевая ошибка) — отдельный класс, чтобы
// различать «сервер ответил 4xx» и «ответа не было вообще».
export class HttpStatusError extends Error {
  status: number;
  constructor(status: number) {
    super(`API error: ${status}`);
    this.status = status;
  }
}

// Отказ, который пройдёт сам: 401 — сессию перевыпустят при следующем входе,
// 429 — лимит отпустит. Такая оценка ждёт в очереди, как при сбое сети;
// прочие 4xx не пройдут и при повторе — экран откатывает плитку (аудит 2026-11, E4).
const RETRY_LATER = new Set([401, 429]);

export function createRatingApi(
  authedFetch: (path: string, init: RequestInit) => Promise<Response>,
  trackEvent: (name: string, meta?: Record<string, unknown>) => void,
) {
  async function rawSaveRating(item: OutboxItem): Promise<SaveRatingResult> {
    const res = await authedFetch('/api/rating', {
      method: 'POST',
      body: JSON.stringify(item),
    });
    if (!res.ok) throw new HttpStatusError(res.status);
    return res.json() as Promise<SaveRatingResult>;
  }

  return {
    saveRating: async (
      needId: string,
      value: number,
      date?: string,
    ): Promise<SaveRatingResult> => {
      // Дата фиксируется здесь: если уйдёт в outbox, сервер должен записать
      // «сегодня по мнению юзера сейчас», а не «сегодня в момент флаша».
      const dt = date ?? todayStr();
      const item: OutboxItem = { needId, value, date: dt };
      try {
        return await rawSaveRating(item);
      } catch (err) {
        // Сеть/таймаут/5xx/401/429 — оффлайн-путь: кладём в outbox и
        // отвечаем успехом (upsert на сервере идемпотентен). Прочие 4xx и
        // недоступное хранилище — бросок: оценка не сохранена нигде.
        const rejected =
          err instanceof HttpStatusError &&
          err.status >= 400 &&
          err.status < 500 &&
          !RETRY_LATER.has(err.status);
        if (rejected || !enqueueRating(item)) throw err;
        return { ok: true, allDone: false, queued: true };
      }
    },
    // Отправляет отложенные оценки (см. ../utils/ratingOutbox.ts). Вызывается
    // один раз на старте (useBootstrapLoad.ts).
    flushOutbox: () =>
      flushRatingOutbox(
        (item) => rawSaveRating(item).then(() => undefined),
        // Спасли записи, сделанные без интернета (правило №8), fire-and-forget.
        (count) => trackEvent('outbox_flush', { count }),
      ),
  };
}
