import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../api';
import type { DayHistory, ModeDiaryEntry } from '../../../../shared/src/types';
import { getTherapistContact } from '../../../../shared/src/utils/therapistContact';
import {
  detectTherapySignal,
  type TherapySignal,
} from '../../../../shared/src/therapy/bridge/therapySignal';
import {
  dismissFor14Days,
  getCrisisSeenAt,
  getDismissedUntil,
} from '../../../../shared/src/therapy/bridge/therapyBridgeState';

interface Loaded {
  history: DayHistory[];
  now: Date;
}

/**
 * Сигнал для карточки моста к терапевту на главной. История за 14 дней грузится
 * по refreshKey; сбой сети — тихо «сигнала нет» (не «данных нет»). Пользователю-
 * терапевту история не запрашивается вовсе. `ready` — ответ (или сбой) уже
 * получен: до него карточка на главной показывает скелетон.
 */
export function useTherapySignal(refreshKey: number | undefined, modeEntries: ModeDiaryEntry[]) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  // Ответ на запрос истории уже есть (данные или сбой): до него карточка не
  // решает «сигнал или спокойная», иначе спокойная мигнёт и пошлёт ложный показ.
  const [settled, setSettled] = useState(false);
  const [dismissedUntil, setDismissedUntil] = useState<string | null>(getDismissedUntil);
  const isTherapist = getTherapistContact().isTherapist;

  useEffect(() => {
    if (isTherapist) return;
    let ignore = false;
    api
      .history(14)
      .then((history) => {
        if (!ignore) setLoaded({ history, now: new Date() });
      })
      .catch(() => {
        if (!ignore) setLoaded(null);
      })
      .finally(() => {
        if (!ignore) setSettled(true);
      });
    return () => {
      ignore = true;
    };
  }, [refreshKey, isTherapist]);

  const signal: TherapySignal | null = useMemo(() => {
    if (isTherapist || !loaded) return null;
    return detectTherapySignal({
      history: loaded.history,
      modeEntries,
      crisisSeenAt: getCrisisSeenAt(),
      dismissedUntil,
      now: loaded.now,
    });
  }, [isTherapist, loaded, modeEntries, dismissedUntil]);

  const dismiss = useCallback(() => {
    dismissFor14Days();
    setDismissedUntil(getDismissedUntil());
  }, []);

  return { signal, dismiss, ready: isTherapist || settled };
}
