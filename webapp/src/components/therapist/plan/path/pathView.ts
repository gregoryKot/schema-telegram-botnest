// Чистая модель раскладки «По фазам» (#1522): строки фаз с датами, прогрессом и флагами, пункты «Без фазы»,
// какая фаза раскрыта на телефоне. Даты и «мы здесь» считает shared/pathPlan — здесь только сборка экрана.
import { todayStr } from '../../../../../../shared/src/utils/format';
import { formatDateString, shiftCalendarDay } from '../../../../../../shared/src/utils/calendarDate';
import type { PlanItem } from '../../../../../../shared/src/therapy/plan/planItem';
import { PATH_PHASE_WEEKS_MAX, type PathPhase, type TherapyPath } from '../../../../../../shared/src/therapy/path/pathModel';
import {
  currentPhaseIndex, currentPhaseOverdue, nextPhaseIndex, phaseDates, progressByPhase,
  type PhaseDates, type PhaseProgress,
} from '../../../../../../shared/src/therapy/path/pathPlan';
import type { PathTemplate, PathTemplatePhase } from '../../../../../../shared/src/therapy/path/templates';

/** Кнопка перехода у фазы: начать следующую, закрыть текущую с переходом или последнюю без него. */
export type PhaseAction = 'start' | 'advance' | 'finish' | null;

export interface PhaseRow {
  phase: PathPhase;
  index: number;
  dates: PhaseDates;
  /** Пункты фазы по `position`; прогресс — null, если считать не из чего. */
  items: PlanItem[];
  progress: PhaseProgress | null;
  /** Фаза шаблона: подсказка в сессиях, критерии перехода, частые ошибки; своя фаза — null. */
  tpl: PathTemplatePhase | null;
  current: boolean;
  done: boolean;
  action: PhaseAction;
  /** Отмечено критериев из `tpl.transition`. */
  criteriaDone: number;
  /** Текущая фаза закончилась по плану раньше сегодняшнего дня; иначе null. */
  overdue: PhaseOverdueRow | null;
}

export interface PhaseOverdueRow {
  /** Полных недель после планового конца. */
  weeks: number;
  /** Новый срок фазы, чтобы плановый конец стал не раньше сегодня; null — потолок уже достигнут. */
  shiftTo: number | null;
}

export interface PathView {
  rows: PhaseRow[];
  /** Пункты без фазы и с фазой, которой в пути нет. */
  unphased: PlanItem[];
  /** Раскрытая на телефоне по умолчанию: текущая, иначе первая не законченная; фаз нет — -1. */
  openIndex: number;
}

const byPosition = (a: PlanItem, b: PlanItem) => a.position - b.position || a.id - b.id;

export function buildPathView(path: TherapyPath, items: readonly PlanItem[], templates: readonly PathTemplate[], today: string = todayStr()): PathView {
  const phases = [...path.phases].sort((a, b) => a.position - b.position);
  const dates = phaseDates(path.startDate, phases);
  const current = currentPhaseIndex(phases);
  const next = nextPhaseIndex(phases);
  const ids = new Set(phases.map((p) => p.id));
  const sorted = [...items].sort(byPosition);
  const progress = progressByPhase(sorted);
  const template = templates.find((t) => t.id === path.templateId) ?? null;
  const overdue = currentPhaseOverdue(path.startDate, phases, today);
  const rows = phases.map((phase, index): PhaseRow => {
    const tpl = template?.phases.find((p) => p.id === phase.templatePhaseId) ?? null;
    const own = sorted.filter((i) => i.phaseId === phase.id);
    let action: PhaseAction = null;
    if (index === current) action = next < 0 ? 'finish' : 'advance';
    else if (current < 0 && index === next) action = 'start';
    return {
      phase, index, dates: dates[index], items: own,
      progress: own.length > 0 ? progress.get(phase.id) ?? null : null,
      tpl, current: index === current, done: phase.endedAt != null, action,
      criteriaDone: tpl ? phase.criteriaDone.filter((n) => n >= 0 && n < tpl.transition.length).length : 0,
      overdue: overdue && overdue.index === index ? { weeks: overdue.weeks, shiftTo: shiftedWeeks(phase.weeks, overdue.catchUpWeeks) } : null,
    };
  });
  const firstOpen = rows.findIndex((r) => !r.done);
  return {
    rows,
    unphased: sorted.filter((i) => i.phaseId == null || !ids.has(i.phaseId)),
    openIndex: current >= 0 ? current : firstOpen,
  };
}

const dayMonth = (day: string) => formatDateString(day, { day: 'numeric', month: 'short' }).replace('.', '');

/** «12 янв — 9 фев»: последний день фазы — накануне старта следующей; через год — с годом у конца. */
export function formatPhaseRange({ start, end }: PhaseDates): string {
  const last = shiftCalendarDay(end, -1);
  const year = last.slice(0, 4) !== start.slice(0, 4) ? ` ${last.slice(0, 4)}` : '';
  return `${dayMonth(start)} — ${dayMonth(last)}${year}`;
}

/** Отметка критерия перехода: номер добавляется или снимается, список — по возрастанию. */
export function toggleCriterion(done: readonly number[], n: number): number[] {
  return done.includes(n) ? done.filter((x) => x !== n) : [...done, n].sort((a, b) => a - b);
}

/** Порядок фаз после перестановки фазы с соседом (dir: -1 — выше); край или фазы нет — null. */
export function movePhaseIds(phases: readonly Pick<PathPhase, 'id' | 'position'>[], id: number, dir: -1 | 1): number[] | null {
  const ids = [...phases].sort((a, b) => a.position - b.position).map((p) => p.id);
  const from = ids.indexOf(id);
  const to = from + dir;
  if (from < 0 || to < 0 || to >= ids.length) return null;
  [ids[from], ids[to]] = [ids[to], ids[from]];
  return ids;
}

/** Срок из поля: целые недели в пределах пути; иначе null — кнопка закрыта. */
export function parseWeeks(value: string): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= PATH_PHASE_WEEKS_MAX ? n : null;
}

/** Новый срок фазы для «сдвинуть сроки»: не меньше прежнего, не больше потолка; растить некуда — null. */
export function shiftedWeeks(weeks: number, catchUpWeeks: number): number | null {
  const next = Math.min(Math.max(weeks, catchUpWeeks), PATH_PHASE_WEEKS_MAX);
  return next > weeks ? next : null;
}

const refKey = (address: string) => address.split('/')[0];

/**
 * Фаза пути, куда по умолчанию встаёт пункт из справочника: та, чья фаза шаблона называет адрес среди
 * `recommended` (раздел целиком) или этап справочника среди `guidePhaseIds`; иначе текущая; иначе null.
 */
export function suggestPhaseId(path: TherapyPath, template: PathTemplate | null, sourceAddress: string | undefined): number | null {
  const phases = [...path.phases].sort((a, b) => a.position - b.position);
  if (sourceAddress && template) {
    const key = refKey(sourceAddress);
    const tpl = template.phases.find((p) => p.recommended.some((r) => refKey(r) === key)
      || (key.startsWith('phase:') && p.guidePhaseIds.includes(key.slice('phase:'.length))));
    const hit = tpl && phases.find((p) => p.templatePhaseId === tpl.id);
    if (hit) return hit.id;
  }
  return phases[currentPhaseIndex(phases)]?.id ?? null;
}
