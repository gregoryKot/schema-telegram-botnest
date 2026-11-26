import { useEffect, useMemo, useState } from 'react';
import { api, type TherapistNote, type UserId } from '../../api';

/** id → название пункта плана клиента для подписей записей; плана не просили, пока ни в одной записи нет отметок. Сбой — пустая карта. */
export function useSessionPlanTitles(clientId: UserId | undefined, notes: TherapistNote[]): ReadonlyMap<number, string> {
  const [items, setItems] = useState<{ id: number; text: string }[]>([]);
  const marked = notes.some((n) => (n.planItemIds?.length ?? 0) > 0);
  const reloadKey = notes[0]?.id;
  useEffect(() => {
    if (clientId == null || !marked) return;
    let alive = true;
    api.getTherapyPlan(clientId).then((list) => { if (alive) setItems(list); }, () => {});
    return () => { alive = false; };
  }, [clientId, marked, reloadKey]);
  return useMemo(() => new Map(items.map((i) => [i.id, i.text])), [items]);
}
