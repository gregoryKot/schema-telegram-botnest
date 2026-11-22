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

/** Пункт меняется местами с соседом своей рубрики (dir: -1 — выше, 1 — ниже). Возвращает весь план в порядке
 *  показа с `position` 0..n-1; null — двигать некуда (край рубрики, пункта нет). */
export function movePlanItem(items: readonly PlanItem[], id: number, dir: -1 | 1): PlanItem[] | null {
  const groups = groupPlan(items).map((g) => [...g.items]);
  const group = groups.find((g) => g.some((i) => i.id === id));
  if (!group) return null;
  const from = group.findIndex((i) => i.id === id);
  const to = from + dir;
  if (to < 0 || to >= group.length) return null;
  [group[from], group[to]] = [group[to], group[from]];
  return groups.flat().map((i, position) => ({ ...i, position }));
}

export const PLAN_STATUS_LABEL: Record<PlanStatus, string> = {
  planned: 'намечено',
  active: 'в работе',
  done: 'сделано',
  postponed: 'отложено',
  dropped: 'не нужно',
};

/** Подпись статуса; неизвестный статус читается как «намечено». */
export function statusLabel(status: string): string {
  return PLAN_STATUS_LABEL[status as PlanStatus] ?? PLAN_STATUS_LABEL.planned;
}

const TAP_CYCLE: readonly string[] = PLAN_STATUSES.slice(0, 3);

/** Тап по статусу: намечено → в работе → сделано → намечено; из «отложено» и «не нужно» — в «намечено». */
export function nextStatus(status: string): PlanStatus {
  return PLAN_STATUSES[(TAP_CYCLE.indexOf(status) + 1) % TAP_CYCLE.length];
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
  const counts: Record<PlanStatus, number> = { planned: 0, active: 0, done: 0, postponed: 0, dropped: 0 };
  for (const i of items) counts[i.status in counts ? i.status : 'planned'] += 1;
  return counts;
}
