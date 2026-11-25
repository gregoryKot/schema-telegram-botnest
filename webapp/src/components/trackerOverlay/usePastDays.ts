import { useEffect, useState } from 'react';
import { api } from '../../api';
import type { DayHistory } from '../../types';
import { todayStr } from '../../../../shared/src/utils/format';
import { PERSISTENT_LOW_DAYS } from '../../../../shared/src/needs/persistentLow';

/**
 * Прошлые дни (без сегодняшнего, от нового к старому) для «низко не первый день» на «Готово».
 * Сбой — пустой список: строка не появится, следующий шаг станет «разобрать», экран не ломается.
 */
export function usePastDays(enabled: boolean): DayHistory[] {
  const [days, setDays] = useState<DayHistory[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    api.history(PERSISTENT_LOW_DAYS)
      .then((h) => { if (alive) setDays(h.filter((d) => d.date !== todayStr())); })
      .catch(() => { /* без истории — без строки «не первый день» */ });
    return () => { alive = false; };
  }, [enabled]);
  return days;
}
