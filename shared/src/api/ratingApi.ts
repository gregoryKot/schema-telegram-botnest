// Оффлайн-надёжность оценки потребности — единственная реализация для обоих
// фронтендов (правило №3 CLAUDE.md). До 2026-08 это работало только в
// мини-аппе: webapp глушил сетевой сбой `catch {}` в TrackerOverlay, и
// оценка терялась без следа — самый глубокий разрыв «парные файлы правятся
// парой» за все волны аудита. Транспорт (authedFetch/trackEvent) у каждого
// фронта свой (initData vs JWT Bearer) — эта функция от него не зависит,
// поэтому единственный параметр различия между webapp/api.ts и
// schema-miniapp/api.ts.
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
};

// Статус ответа сервера (не сетевая ошибка) — отдельный класс, чтобы
// различать «сервер ответил 4xx» и «ответа не было вообще».
export class HttpStatusError extends Error {
  constructor(public status: number) {
    super(`API error: ${status}`);
  }
}

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
        // 4xx кидаем как раньше; сеть/таймаут/5xx — оффлайн-путь: кладём в
        // outbox и отвечаем успехом (upsert на сервере идемпотентен).
        const isClientError =
          err instanceof HttpStatusError &&
          err.status >= 400 &&
          err.status < 500;
        if (isClientError) throw err;
        enqueueRating(item);
        return { ok: true, allDone: false };
      }
    },
    // Отправляет отложенные оценки (см. ../utils/ratingOutbox.ts). Вызывается
    // один раз на старте (useBootstrapLoad.ts / App.tsx у мини-аппа).
    flushOutbox: () =>
      flushRatingOutbox(
        (item) => rawSaveRating(item).then(() => undefined),
        // Спасли записи, сделанные без интернета (правило №8), fire-and-forget.
        (count) => trackEvent('outbox_flush', { count }),
      ),
  };
}
