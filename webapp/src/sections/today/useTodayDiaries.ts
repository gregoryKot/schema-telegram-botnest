import { useCallback, useEffect, useState } from 'react';
import { api, reportClientError } from '../../api';
import { isDiaryToday } from '../../../../shared/src/diary/diaryDay';
import { mergeRecentEntries, type RecentEntry } from './model';

export interface TodayDone { schema: boolean; mode: boolean; gratitude: boolean }
const NOTHING_DONE: TodayDone = { schema: false, mode: false, gratitude: false };

// Три дневника экрана «Сегодня»: последние записи и «сделано сегодня» для
// фокус-карточки. reloadDiaries перечитывает их после записи, не сбрасывая
// профиль и остальной экран в скелетон. Сбой источника — в reportClientError.
export function useTodayDiaries(refreshKey: number | undefined) {
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  const [diariesLoaded, setDiariesLoaded] = useState(false);
  const [todayDone, setTodayDone] = useState<TodayDone>(NOTHING_DONE);
  // Пункты сегодняшней благодарности: «Ещё» в карточке дописывает, а не затирает.
  const [gratitudeToday, setGratitudeToday] = useState<string[] | undefined>();
  const [tick, setTick] = useState(0);

  // Сброс в загрузку по refreshKey — прямо в рендере, как в useTodayData.
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
        setRecent(mergeRecentEntries({ schema, mode, gratitude }));
        setTodayDone({
          schema: schema.some(e => isDiaryToday(e.createdAt)),
          mode: mode.some(e => isDiaryToday(e.createdAt)),
          gratitude: gratitude.some(e => isDiaryToday(e.date)),
        });
        setGratitudeToday(gratitude.find(e => isDiaryToday(e.date))?.items);
      })
      .catch(() => reportClientError({ message: 'today diaries background load failed', section: 'today' }))
      .finally(() => { if (!ignore) setDiariesLoaded(true); });
    return () => { ignore = true; };
  }, [refreshKey, tick]);

  const reloadDiaries = useCallback(() => setTick(t => t + 1), []);

  return { recent, diariesLoaded, todayDone, gratitudeToday, reloadDiaries };
}
