import { useEffect, useState } from 'react';
import { api, reportClientError } from '../../api';
import type { UserProfile } from '../../types';
import { useTodayDiaries } from './useTodayDiaries';

// Фоновые загрузки главной «Сегодня»: профиль (имя) и три дневника. Сбой
// источника экран не роняет — уходит в reportClientError (раздел 'today'),
// блок остаётся с пустым состоянием.
export function useTodayData(refreshKey: number | undefined) {
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const diaries = useTodayDiaries(refreshKey);
  // Сброс в состояние загрузки по refreshKey: корректировка состояния прямо в рендере.
  const [seenRefresh, setSeenRefresh] = useState(refreshKey);
  if (refreshKey !== seenRefresh) {
    setSeenRefresh(refreshKey);
    setProfile(null);
  }

  useEffect(() => {
    let ignore = false;
    api.getProfile().then(p => { if (!ignore) setProfile(p); })
      .catch(() => reportClientError({ message: 'today profile background load failed', section: 'today' }));
    return () => { ignore = true; };
  }, [refreshKey]);

  return { profile, ...diaries };
}
