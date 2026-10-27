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
 * терапевту история не запрашивается вовсе.
 */
export function useTherapySignal(refreshKey: number | undefined, modeEntries: ModeDiaryEntry[]) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
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

  return { signal, dismiss };
}
