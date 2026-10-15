import { useEffect, useState } from 'react';
import { api, reportClientError } from '../../api';
import type { TherapyRelationInfo } from '../../api';
import type { UserProfile } from '../../types';
import { MY_SCHEMA_IDS_KEY } from '../../utils/storageKeys';
import { readLocalIds } from './helpers';
import { mergeRecentEntries, type RecentEntry } from './model';

type HistoryDays = Array<{ date: string; ratings: Record<string, number> }>;

// Фоновые загрузки экрана «Сегодня»: профиль, три дневника, связь с терапевтом,
// история оценок за 14 дней. Сбой источника экран не роняет — уходит в
// reportClientError (раздел 'today'), блок остаётся с пустым состоянием.
export function useTodayData(refreshKey: number | undefined) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [manualSchemaIds, setManualSchemaIds] = useState<string[]>(() => readLocalIds(MY_SCHEMA_IDS_KEY));
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  const [diariesLoaded, setDiariesLoaded] = useState(false);
  const [therapyRelation, setTherapyRelation] = useState<TherapyRelationInfo | null>(null);
  const [historyDays, setHistoryDays] = useState<HistoryDays>([]);

  // Сброс в состояние загрузки по refreshKey: корректировка состояния прямо в
  // рендере (не в эффекте), на маунте profile/diariesLoaded и так null/false.
  const [seenRefresh, setSeenRefresh] = useState(refreshKey);
  if (refreshKey !== seenRefresh) {
    setSeenRefresh(refreshKey);
    setProfile(null);
    setDiariesLoaded(false);
  }

  useEffect(() => {
    let ignore = false;

    api.getProfile().then(p => {
      if (ignore) return;
      setProfile(p);
      if (p.mySchemaIds.length > 0) {
        setManualSchemaIds(p.mySchemaIds);
        localStorage.setItem(MY_SCHEMA_IDS_KEY, JSON.stringify(p.mySchemaIds));
      }
    }).catch(() => reportClientError({ message: 'today profile background load failed', section: 'today' }));

    Promise.all([api.getSchemaDiary(), api.getModeDiary(), api.getGratitudeDiary()])
      .then(([schema, mode, gratitude]) => {
        if (!ignore) setRecent(mergeRecentEntries({ schema, mode, gratitude }));
      })
      .catch(() => reportClientError({ message: 'today diaries background load failed', section: 'today' }))
      .finally(() => { if (!ignore) setDiariesLoaded(true); });

    api.getTherapyRelation().then(r => { if (!ignore && r) setTherapyRelation(r); })
      .catch(() => reportClientError({ message: 'today therapy relation load failed', section: 'today' }));

    api.history(14).then(days => { if (!ignore) setHistoryDays(days); })
      .catch(() => reportClientError({ message: 'today history background load failed', section: 'today' }));

    return () => { ignore = true; };
  }, [refreshKey]);

  return { profile, manualSchemaIds, recent, diariesLoaded, therapyRelation, historyDays };
}
