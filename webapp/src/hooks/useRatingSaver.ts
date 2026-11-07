import { useCallback, useEffect, useRef } from 'react';
import { api, reportClientError } from '../api';
import type { StreakData } from '../api';
import { todayStr } from '../../../shared/src/utils/format';

export const RATING_SAVE_DELAY_MS = 500;

// Сохранение оценки потребности — одно на сайт (правило «одна механика — один
// компонент»): им пользуются и трекер, и шкала на экране «Сегодня». Серия
// быстрых кликов по одной потребности даёт один запрос; 0 — «не оценено», не
// сохраняется. День оценки — день касания, а не отправки: тап в 23:59:59 не
// уезжает в завтра через полсекунды задержки (QA 2026-11-03, К3).
// Без сети запрос всё равно уходит: упав, он кладёт оценку в офлайн-очередь
// (shared/api/ratingApi), как и обещает плашка «Нет сети». Раньше без сети
// оценка не сохранялась нигде и пропадала с перезагрузкой. Ушла в очередь — `onQueued`:
// экран говорит «отправится позже», а не молча «готово» (QA B-З9).
export function useRatingSaver(opts: {
  date?: string;
  onSaved?: (needId: string, streak?: StreakData) => void;
  onSavedAt?: () => void;
  onQueued?: () => void;
  errorMessage: string;
  section: string;
}) {
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  // Ждущие debounce значения: при закрытии экрана они уходят сразу, а не теряются —
  // после автоперехода трекера «На главную» на экране «Готово» легко нажать раньше 500 мс.
  const pending = useRef<Record<string, { value: number; day: string }>>({});
  const latest = useRef(opts);
  useEffect(() => {
    latest.current = opts;
  });

  const send = useCallback(async (needId: string, value: number, day: string) => {
    if (value === 0) return;
    const c = latest.current;
    try {
      const res = await api.saveRating(needId, value, day);
      c.onSaved?.(needId, res.allDone ? res.streak : undefined);
      c.onSavedAt?.();
      if (res.queued) c.onQueued?.();
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
      Object.entries(p).forEach(([needId, { value, day }]) => void send(needId, value, day));
    };
  }, [send]);

  return useCallback((needId: string, value: number) => {
    clearTimeout(timers.current[needId]);
    const day = latest.current.date ?? todayStr();
    pending.current[needId] = { value, day };
    timers.current[needId] = setTimeout(() => {
      delete pending.current[needId];
      void send(needId, value, day);
    }, RATING_SAVE_DELAY_MS);
  }, [send]);
}
