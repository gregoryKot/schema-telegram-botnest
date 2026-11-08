import { useCallback, useEffect, useRef } from 'react';
import { api, reportClientError } from '../api';
import type { StreakData } from '../api';
import { todayStr } from '../../../shared/src/utils/format';

export const RATING_SAVE_DELAY_MS = 500;

type Pending = { value: number; day: string; prev: number | undefined };

// Сохранение оценки потребности — одно на сайт (правило «одна механика — один
// компонент»). Серия быстрых кликов по одной потребности даёт один запрос;
// 0 — «не оценено», не сохраняется. День оценки — день касания, а не отправки
// (QA 2026-11-03, К3). Без сети запрос всё равно уходит и, упав, кладёт оценку
// в офлайн-очередь (shared/api/ratingApi) — `onQueued`: экран говорит
// «отправится позже», а не молча «готово» (QA B-З9). Сервер отказал насовсем
// (4xx кроме 401/429) — `onRejected` с оценкой до серии касаний: плитка
// откатывается, а не врёт о сохранённом (аудит 2026-11, E4).
export function useRatingSaver(opts: {
  date?: string;
  onSaved?: (needId: string, streak?: StreakData) => void;
  onSavedAt?: () => void;
  onQueued?: () => void;
  onRejected?: (needId: string, prev: number | undefined) => void;
  errorMessage: string;
  section: string;
}) {
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  // Ждущие debounce значения: при закрытии экрана они уходят сразу, а не теряются —
  // после автоперехода трекера «На главную» на экране «Готово» легко нажать раньше 500 мс.
  const pending = useRef<Record<string, Pending>>({});
  const latest = useRef(opts);
  useEffect(() => {
    latest.current = opts;
  });

  const send = useCallback(async (needId: string, { value, day, prev }: Pending) => {
    if (value === 0) return;
    const c = latest.current;
    try {
      const res = await api.saveRating(needId, value, day);
      c.onSaved?.(needId, res.allDone ? res.streak : undefined);
      c.onSavedAt?.();
      if (res.queued) c.onQueued?.();
    } catch (e) {
      // Сеть/5xx/401/429 — в outbox (shared/api/ratingApi); сюда доходит
      // оценка, не сохранённая нигде, — она редкая, потому видимая.
      console.error('saveRating failed', e);
      reportClientError({ message: c.errorMessage, section: c.section });
      c.onRejected?.(needId, prev);
    }
  }, []);

  useEffect(() => {
    const t = timers.current;
    const p = pending.current;
    return () => {
      Object.values(t).forEach(clearTimeout);
      Object.entries(p).forEach(([needId, item]) => void send(needId, item));
    };
  }, [send]);

  // prev — оценка на экране до касания; в серии касаний откат идёт к первой.
  return useCallback((needId: string, value: number, prev?: number) => {
    clearTimeout(timers.current[needId]);
    const day = latest.current.date ?? todayStr();
    const prior = pending.current[needId];
    const item = { value, day, prev: prior ? prior.prev : prev };
    pending.current[needId] = item;
    timers.current[needId] = setTimeout(() => {
      delete pending.current[needId];
      void send(needId, item);
    }, RATING_SAVE_DELAY_MS);
  }, [send]);
}
