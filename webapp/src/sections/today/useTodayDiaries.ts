import { useCallback, useEffect, useState } from 'react';
import { api, reportClientError } from '../../api';
import type { ModeDiaryEntry } from '../../../../shared/src/types';
import { buildDiaryFeed, casesTodayCount, lastEntryAt, type FeedEntry } from './todayFeed';

interface DiariesState {
  /** Записи трёх дневников за сегодня (без строки трекера). */
  feed: FeedEntry[];
  /** Разборов «Что случилось» за сегодня (записи режимов с fromCase). */
  casesToday: number;
  lastAt: string | null;
  /** Все записи дневника режимов — сигнал моста к терапевту считает повторы. */
  modeEntries: ModeDiaryEntry[];
}
const EMPTY: DiariesState = { feed: [], casesToday: 0, lastAt: null, modeEntries: [] };

// Три дневника главной «Сегодня»: записи за сегодня для ленты, счётчики для
// плиток. reloadDiaries перечитывает их после разбора, не сбрасывая профиль и
// остальной экран в скелетон. Сбой источника — в reportClientError, экран
// остаётся с пустым состоянием.
export function useTodayDiaries(refreshKey: number | undefined) {
  const [state, setState] = useState<DiariesState>(EMPTY);
  const [diariesLoaded, setDiariesLoaded] = useState(false);
  const [tick, setTick] = useState(0);

  // Сброс в загрузку по refreshKey — прямо в рендере, не в эффекте.
  const [seenRefresh, setSeenRefresh] = useState(refreshKey);
  if (refreshKey !== seenRefresh) {
    setSeenRefresh(refreshKey);
    setDiariesLoaded(false);
  }

  useEffect(() => {
    let ignore = false;
    Promise.all([api.getSchemaDiary(), api.getModeDiary(), api.getGratitudeDiary()])
      .then(([schema, mode, gratitude]) => {
        if (ignore) return;
        const src = { schema, mode, gratitude };
        setState({
          feed: buildDiaryFeed(src),
          casesToday: casesTodayCount(src),
          lastAt: lastEntryAt(src),
          modeEntries: mode,
        });
      })
      .catch(() => reportClientError({ message: 'today diaries background load failed', section: 'today' }))
      .finally(() => { if (!ignore) setDiariesLoaded(true); });
    return () => { ignore = true; };
  }, [refreshKey, tick]);

  const reloadDiaries = useCallback(() => setTick(t => t + 1), []);

  return { ...state, diariesLoaded, reloadDiaries };
}
