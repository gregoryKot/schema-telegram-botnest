import {
  PLAN_RUBRICS, PLAN_RUBRIC_LABEL, PLAN_STATUSES,
  type PlanItem, type PlanRubric, type PlanStatus,
} from '../../../../../shared/src/therapy/plan/planItem';

// Чистая модель вкладки «План работы» (#1337): порядок рубрик, цикл статуса, что показывать.

export interface PlanGroup { rubric: PlanRubric; label: string; items: PlanItem[] }

/** Пункты по рубрикам в порядке справочника; внутри — по `position`. Пустая рубрика не показывается,
 *  рубрика, которой сайт не знает (сервер новее), уходит в «Своё» — пункт не теряется. */
export function groupPlan(items: readonly PlanItem[]): PlanGroup[] {
  const known = (r: string): PlanRubric => ((PLAN_RUBRICS as readonly string[]).includes(r) ? (r as PlanRubric) : 'custom');
  const sorted = [...items].sort((a, b) => a.position - b.position || a.id - b.id);
  return PLAN_RUBRICS
    .map((rubric) => ({ rubric, label: PLAN_RUBRIC_LABEL[rubric], items: sorted.filter((i) => known(i.rubric) === rubric) }))
    .filter((g) => g.items.length > 0);
}

export const PLAN_STATUS_LABEL: Record<PlanStatus, string> = {
  planned: 'намечено',
  active: 'в работе',
  done: 'сделано',
};

/** Подпись статуса; неизвестный статус читается как «намечено». */
export function statusLabel(status: string): string {
  return PLAN_STATUS_LABEL[status as PlanStatus] ?? PLAN_STATUS_LABEL.planned;
}

/** Тап по статусу: намечено → в работе → сделано → намечено. */
export function nextStatus(status: string): PlanStatus {
  const i = (PLAN_STATUSES as readonly string[]).indexOf(status);
  return PLAN_STATUSES[(i + 1) % PLAN_STATUSES.length];
}

export function isEmptyPlan(items: readonly PlanItem[]): boolean {
  return items.length === 0;
}

/** «Дать заданием» — только у пункта «Между сессиями», который заданием ещё не выдан. */
export function canAssign(item: Pick<PlanItem, 'rubric' | 'taskId'>): boolean {
  return item.rubric === 'between' && item.taskId == null;
}

/** Текст пункта к сохранению: без краёв; пустой — null (не сохраняется). */
export function cleanText(text: string): string | null {
  const t = text.trim();
  return t ? t : null;
}

/** Сколько пунктов в каком статусе — строка под заголовком вкладки. */
export function planCounts(items: readonly PlanItem[]): Record<PlanStatus, number> {
  const counts: Record<PlanStatus, number> = { planned: 0, active: 0, done: 0 };
  for (const i of items) counts[i.status in counts ? i.status : 'planned'] += 1;
  return counts;
}
