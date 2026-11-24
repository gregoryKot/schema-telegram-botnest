import { useEffect, useRef, useState } from 'react';
import { api, type UserId } from '../../../api';
import type { PlanItem } from '../../../../../shared/src/therapy/plan/planItem';
import { planItemAddress } from '../../../../../shared/src/therapy/plan/planAddress';

/** Тот же пункт уже в плане: взят из того же раздела справочника тем же текстом. */
export const isPlanTwin = (item: Pick<PlanItem, 'text' | 'sourceAddress' | 'source'>, sourceAddress: string, text: string) =>
  planItemAddress(item) === sourceAddress && item.text.trim() === text.trim();

/**
 * Защита «В план» от дублей: планы выбранных клиентов грузятся тихо, по разу на лист; `has(id, text)` —
 * у клиента уже стоит такой пункт. План не загрузился — дублей не видно, пункт добавляется как обычно.
 */
export function usePlanTwins(clientIds: readonly string[], sourceAddress: string) {
  const [plans, setPlans] = useState<Record<string, PlanItem[]>>({});
  const asked = useRef(new Set<string>());
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const key = clientIds.join(',');
  useEffect(() => {
    for (const id of key ? key.split(',') : []) {
      if (asked.current.has(id)) continue;
      asked.current.add(id);
      api.getTherapyPlan(id as UserId).then(
        (items) => { if (alive.current) setPlans((p) => ({ ...p, [id]: items })); },
        () => {},
      );
    }
  }, [key]);
  return { has: (id: string, text: string) => !!plans[id]?.some((i) => isPlanTwin(i, sourceAddress, text)) };
}
