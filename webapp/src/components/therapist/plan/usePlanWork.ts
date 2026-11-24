import { useEffect, useState } from 'react';
import { api, type UserId } from '../../../api';
import { summarizePlanWork, type PlanWorkSummary } from '../../../../../shared/src/therapy/plan/planWork';

/** Сколько раз и когда работали над пунктами: один запрос на вкладку; сбой — строк просто нет. */
export function usePlanWork(clientId: UserId): Map<number, PlanWorkSummary> {
  const [summary, setSummary] = useState<Map<number, PlanWorkSummary>>(new Map());
  useEffect(() => {
    let alive = true;
    void api.getPlanWork(clientId).then(
      (res) => { if (alive) setSummary(summarizePlanWork(res.entries)); },
      () => undefined,
    );
    return () => { alive = false; };
  }, [clientId]);
  return summary;
}
