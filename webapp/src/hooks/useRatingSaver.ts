import { useCallback, useEffect, useRef } from 'react';
import { api, reportClientError } from '../api';
import type { StreakData } from '../api';

export const RATING_SAVE_DELAY_MS = 500;

// Сохранение оценки потребности — одно на сайт (правило «одна механика — один
// компонент»): им пользуются и трекер, и шкала на экране «Сегодня». Серия
// быстрых кликов по одной потребности даёт один запрос; 0 — «не оценено», не
// сохраняется; офлайн — не шлём (оценка остаётся локальной до синка).
export function useRatingSaver({ date, isOffline = false, onSaved, onSavedAt, errorMessage, section }: {
  date?: string;
  isOffline?: boolean;
  onSaved?: (needId: string, streak?: StreakData) => void;
  onSavedAt?: () => void;
  errorMessage: string;
  section: string;
}) {
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  // Ждущие debounce значения: при закрытии экрана они уходят сразу, а не теряются —
  // после автоперехода трекера «На главную» на экране «Готово» легко нажать раньше 500 мс.
  const pending = useRef<Record<string, number>>({});
  const latest = useRef({ date, onSaved, onSavedAt, errorMessage, section });
  useEffect(() => {
    latest.current = { date, onSaved, onSavedAt, errorMessage, section };
  });

  const send = useCallback(async (needId: string, value: number) => {
    if (value === 0) return;
    const c = latest.current;
    try {
      const res = c.date ? await api.saveRating(needId, value, c.date) : await api.saveRating(needId, value);
      c.onSaved?.(needId, res.allDone ? res.streak : undefined);
      c.onSavedAt?.();
    } catch (e) {
      // Сеть/5xx — в outbox (shared/api/ratingApi); сюда доходит только
      // настоящая ошибка запроса (4xx) — она редкая, потому видимая.
      console.error('saveRating failed', e);
      reportClientError({ message: c.errorMessage, section: c.section });
    }
  }, []);

  useEffect(() => {
    const t = timers.current;
    const p = pending.current;
    return () => {
      Object.values(t).forEach(clearTimeout);
      Object.entries(p).forEach(([needId, value]) => void send(needId, value));
    };
  }, [send]);

  return useCallback((needId: string, value: number) => {
    if (isOffline) return;
    clearTimeout(timers.current[needId]);
    pending.current[needId] = value;
    timers.current[needId] = setTimeout(() => {
      delete pending.current[needId];
      void send(needId, value);
    }, RATING_SAVE_DELAY_MS);
  }, [isOffline, send]);
}
