import { useEffect, useState } from 'react';
import { api } from '../../api';
import type { CaseHistoryEntry } from '../../../../shared/src/case/quick/caseRepeat';

/**
 * Записи режимов ДО этого разбора: грузятся один раз при открытии потока.
 * null — ещё грузится или сбой: тогда экран не говорит ни «впервые», ни «повтор».
 */
export function useCaseModeHistory(): CaseHistoryEntry[] | null {
  const [entries, setEntries] = useState<CaseHistoryEntry[] | null>(null);
  useEffect(() => {
    let ignore = false;
    api.getModeDiary()
      .then((list) => { if (!ignore) setEntries(list.map((e) => ({ modeId: e.modeId, createdAt: e.createdAt }))); })
      .catch((e) => console.error('case mode history load failed', e));
    return () => { ignore = true; };
  }, []);
  return entries;
}
