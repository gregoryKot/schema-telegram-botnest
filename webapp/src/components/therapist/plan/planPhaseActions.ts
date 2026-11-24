import { api, type UserId } from '../../../api';
import type { PlanItemPatch } from '../../../../../shared/src/therapy/plan/planApi';
import type { PlanItem, PlanRubric } from '../../../../../shared/src/therapy/plan/planItem';
import { trackPlanItemAdded } from '../../../../../shared/src/share/planAnalytics';

interface Ctx {
  clientId: UserId;
  alive: { current: boolean };
  run: (id: number | 'new', failText: string, work: () => Promise<void>) => Promise<boolean>;
  patch: (id: number, body: PlanItemPatch, failText?: string) => Promise<boolean>;
  add: (rubric: PlanRubric, text: string) => Promise<boolean>;
  setItems: (fn: (prev: PlanItem[] | null) => PlanItem[] | null) => void;
  replace: (next: PlanItem) => void;
}

/** Правки пунктов по фазам пути поверх общего `run` хука плана; контекст — функцией (ref не читается при рендере). */
export function phaseActions(ctx: () => Ctx) {
  return {
    /** Новый пункт сразу в фазе: один запрос, сервер проверяет принадлежность фазы. */
    addToPhase: (phaseId: number | null, rubric: PlanRubric, text: string) => {
      const { clientId, alive, run, add, setItems } = ctx();
      if (phaseId === null) return add(rubric, text);
      return run('new', 'Не удалось добавить пункт в фазу', async () => {
        const { items: created } = await api.createPlanItems({ clientIds: [String(clientId)], rubric, text, phaseId });
        trackPlanItemAdded(api, rubric, false);
        if (alive.current) setItems((prev) => [...(prev ?? []), ...created]);
      });
    },
    /** Перенос в фазу (null — «Без фазы»); ответ сервера обновляет пункт. */
    setPhase: async (item: PlanItem, phaseId: number | null) => {
      if (phaseId !== item.phaseId) await ctx().patch(item.id, { phaseId }, 'Не удалось перенести пункт');
    },
  };
}
