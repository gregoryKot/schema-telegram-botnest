import { useEffect, useRef, useState } from 'react';
import { api, reportClientError } from '../../../api';
import { trackPlanItemAdded } from '../../../../../shared/src/share/planAnalytics';

type NewItems = Parameters<typeof api.createPlanItems>[0];

/** Действия листа «В план»: добавить пункт выбранным клиентам и отменить только что добавленное. */
export function usePlanAdd({ added, setAdded, onAdded }: {
  /** id добавленных пунктов; null — ещё не добавляли. */
  added: number[] | null; setAdded: (ids: number[] | null) => void; onAdded?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const run = async (work: () => Promise<number[] | null>, log: string, failed: string) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const next = await work();
      onAdded?.();
      if (alive.current) setAdded(next);
    } catch {
      reportClientError({ message: log, section: 'therapist.plan' });
      if (alive.current) setError(failed);
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  return {
    busy, error,
    save: (body: NewItems) => (body.clientIds.length === 0 ? Promise.resolve() : run(async () => {
      const { items } = await api.createPlanItems(body);
      trackPlanItemAdded(api, body.rubric, true);
      return items.map((i) => i.id);
    }, 'therapy plan add from guide failed', 'Не удалось добавить в план')),
    undo: () => run(async () => {
      await Promise.all((added ?? []).map((id) => api.deletePlanItem(id)));
      return null;
    }, 'therapy plan add undo failed', 'Не удалось отменить — пункт можно убрать во вкладке «План работы»'),
  };
}
