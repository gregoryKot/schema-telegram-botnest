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
  useEffect(() => {
    const t = timers.current;
    return () => Object.values(t).forEach(clearTimeout);
  }, []);

  return useCallback((needId: string, value: number) => {
    if (isOffline) return;
    clearTimeout(timers.current[needId]);
    timers.current[needId] = setTimeout(async () => {
      if (value === 0) return;
      try {
        const res = date ? await api.saveRating(needId, value, date) : await api.saveRating(needId, value);
        onSaved?.(needId, res.allDone ? res.streak : undefined);
        onSavedAt?.();
      } catch (e) {
        // Сеть/5xx — в outbox (shared/api/ratingApi); сюда доходит только
        // настоящая ошибка запроса (4xx) — она редкая, потому видимая.
        console.error('saveRating failed', e);
        reportClientError({ message: errorMessage, section });
      }
    }, RATING_SAVE_DELAY_MS);
  }, [date, isOffline, onSaved, onSavedAt, errorMessage, section]);
}
