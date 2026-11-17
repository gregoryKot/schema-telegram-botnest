import { useEffect, useRef, useState } from 'react';
import { api, reportClientError, type UserId } from '../../../api';
import type { PlanItemPatch } from '../../../../../shared/src/therapy/plan/planApi';
import type { PlanItem, PlanRubric } from '../../../../../shared/src/therapy/plan/planItem';
import { trackPlanItemAdded, trackPlanItemStatus } from '../../../../../shared/src/share/planAnalytics';
import { nextStatus } from './planModel';

/**
 * План работы открытого клиента (#1337): загрузка и правки. `items === null` — ещё грузится; `failed` — план
 * не пришёл (сбой ≠ пусто: пустое состояние не показывается). Правка идёт строго по одной: пока запрос в пути
 * (`busyId`; `'new'` — добавление), строки закрыты и второй запрос не уходит. Отказ виден в `error`. Статус
 * меняется сразу и откатывается при отказе. `pendingLinks` — задание создано, а отметка в пункте не дошла:
 * «Повторить» шлёт только отметку, второго задания не создаёт.
 * Вкладка монтируется с ключом клиента, поэтому поздний ответ прежнего клиента сюда не попадает (`alive`).
 */
export function usePlanItems(clientId: UserId) {
  const [items, setItems] = useState<PlanItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busyId, setBusyId] = useState<number | 'new' | null>(null);
  const [error, setError] = useState('');
  const [pendingLinks, setPendingLinks] = useState<Record<number, number>>({});
  const inFlight = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const fetchPlan = () => {
    api.getTherapyPlan(clientId).then(
      (list) => { if (alive.current) setItems(list); },
      () => {
        if (!alive.current) return;
        setFailed(true);
        reportClientError({ message: 'therapy plan load failed', section: 'therapist.plan' });
      },
    );
  };
  useEffect(fetchPlan, [clientId]);
  const reload = () => { setFailed(false); fetchPlan(); };

  const replace = (next: PlanItem) => setItems((prev) => prev && prev.map((i) => (i.id === next.id ? next : i)));

  /** Общий путь правки: занятость, отказ строкой, true — сервер принял. */
  async function run(id: number | 'new', failText: string, work: () => Promise<void>): Promise<boolean> {
    if (inFlight.current) return false;
    inFlight.current = true;
    setBusyId(id);
    setError('');
    try {
      await work();
      return true;
    } catch {
      reportClientError({ message: 'therapy plan change failed', section: 'therapist.plan' });
      if (alive.current) setError(failText);
      return false;
    } finally {
      inFlight.current = false;
      if (alive.current) setBusyId(null);
    }
  }

  const add = (rubric: PlanRubric, text: string) => run('new', 'Не удалось добавить пункт', async () => {
    const { items: created } = await api.createPlanItems({ clientIds: [String(clientId)], rubric, text });
    trackPlanItemAdded(api, rubric, false);
    if (alive.current) setItems((prev) => [...(prev ?? []), ...created]);
  });

  const patch = (id: number, body: PlanItemPatch, failText = 'Не удалось сохранить пункт') => run(id, failText, async () => {
    const saved = await api.updatePlanItem(id, body);
    if (alive.current) replace(saved);
  });

  /** Тап по статусу: новый статус виден сразу, отказ возвращает прежний. */
  const cycleStatus = async (item: PlanItem) => {
    const status = nextStatus(item.status);
    replace({ ...item, status });
    const ok = await patch(item.id, { status });
    if (ok) trackPlanItemStatus(api, status);
    // Откат — только статуса и в актуальном пункте: остальные поля могли измениться.
    else if (alive.current) setItems((prev) => prev && prev.map((i) => (i.id === item.id ? { ...i, status: item.status } : i)));
  };

  /** «Дать заданием»: задание создано — пункт помнит его id. Отметка не дошла — id ждёт в `pendingLinks`. */
  const linkTask = async (id: number, taskId: number) => {
    setPendingLinks((prev) => ({ ...prev, [id]: taskId }));
    const ok = await patch(id, { taskId }, '');
    if (ok && alive.current) setPendingLinks((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => Number(k) !== id)));
    return ok;
  };

  const remove = (id: number) => run(id, 'Не удалось удалить пункт', async () => {
    await api.deletePlanItem(id);
    if (alive.current) setItems((prev) => prev && prev.filter((i) => i.id !== id));
  });

  return {
    items, failed, busyId, error, reload, pendingLinks,
    clearError: () => setError(''),
    add, cycleStatus, remove, linkTask,
    saveText: (id: number, text: string) => patch(id, { text }),
    /** Повтор отметки «выдано заданием» — только PATCH, без нового задания. */
    retryLink: (id: number) => (pendingLinks[id] != null ? linkTask(id, pendingLinks[id]) : Promise.resolve(false)),
  };
}

export type PlanItems = ReturnType<typeof usePlanItems>;
