import { useEffect, useState } from 'react';
import { api, type UserId } from '../../api';
import type { PlanItem, PlanStatus } from '../../../../shared/src/therapy/plan/planItem';
import type { TherapyPath } from '../../../../shared/src/therapy/path/pathModel';
import { currentPhaseIndex } from '../../../../shared/src/therapy/path/pathPlan';
import { planWorkCandidates } from '../../../../shared/src/therapy/plan/planWork';

export interface PlanWorkGroup { phaseId: number | null; name: string | null; current: boolean; items: PlanItem[] }

/** Группы кандидатов «Из плана» (текущая фаза первой) и быстрая смена статуса; сбой загрузки — пустой список, блок скрыт. */
export function useSessionPlan(clientId: UserId, reloadKey?: number) {
  const [data, setData] = useState<{ items: PlanItem[]; path: TherapyPath | null; statuses: Record<number, PlanStatus> } | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    const path = api.getTherapyPath(clientId).then((r) => r.path, () => null);
    void Promise.all([api.getTherapyPlan(clientId), path]).then(
      ([items, p]) => { if (alive) setData({ items, path: p, statuses: {} }); },
      () => { if (alive) setData({ items: [], path: null, statuses: {} }); },
    );
    return () => { alive = false; };
  }, [clientId, reloadKey]);

  const statuses = data?.statuses ?? {};
  const phases = data?.path?.phases ?? [];
  const current = phases[currentPhaseIndex(phases)];
  const groups: PlanWorkGroup[] = [];
  for (const item of planWorkCandidates(data?.items ?? [], current?.id ?? null, phases.map((p) => p.id))) {
    const phase = phases.find((p) => p.id === item.phaseId);
    const last = groups[groups.length - 1];
    if (last && last.phaseId === (phase?.id ?? null)) last.items.push(item);
    else groups.push({ phaseId: phase?.id ?? null, name: phase?.name ?? null, current: phase?.id === current?.id && !!phase, items: [item] });
  }

  /** Тап по уже выбранному статусу возвращает статус, с каким пункт пришёл. */
  async function toggle(item: PlanItem, target: PlanStatus) {
    const next = (statuses[item.id] ?? item.status) === target ? item.status : target;
    setBusyId(item.id);
    setError('');
    try {
      await api.updatePlanItem(item.id, { status: next });
      setData((d) => d && { ...d, statuses: { ...d.statuses, [item.id]: next } });
    } catch {
      setError('Не удалось сохранить статус пункта');
    } finally {
      setBusyId(null);
    }
  }
  return { loading: data === null, groups, hasPath: !!data?.path, statuses, busyId, error, toggle };
}
