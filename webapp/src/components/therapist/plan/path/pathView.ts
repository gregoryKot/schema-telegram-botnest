// Чистая модель раскладки «По фазам» (#1522): строки фаз с датами, прогрессом и флагами, пункты «Без фазы»,
// какая фаза раскрыта на телефоне. Даты и «мы здесь» считает shared/pathPlan — здесь только сборка экрана.
import { formatDateString, shiftCalendarDay } from '../../../../../../shared/src/utils/calendarDate';
import type { PlanItem } from '../../../../../../shared/src/therapy/plan/planItem';
import type { PathPhase, TherapyPath } from '../../../../../../shared/src/therapy/path/pathModel';
import {
  currentPhaseIndex, nextPhaseIndex, phaseDates, progressByPhase,
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
}

export interface PathView {
  rows: PhaseRow[];
  /** Пункты без фазы и с фазой, которой в пути нет. */
  unphased: PlanItem[];
  /** Раскрытая на телефоне по умолчанию: текущая, иначе первая не законченная; фаз нет — -1. */
  openIndex: number;
}

const byPosition = (a: PlanItem, b: PlanItem) => a.position - b.position || a.id - b.id;

export function buildPathView(path: TherapyPath, items: readonly PlanItem[], templates: readonly PathTemplate[]): PathView {
  const phases = [...path.phases].sort((a, b) => a.position - b.position);
  const dates = phaseDates(path.startDate, phases);
  const current = currentPhaseIndex(phases);
  const next = nextPhaseIndex(phases);
  const ids = new Set(phases.map((p) => p.id));
  const sorted = [...items].sort(byPosition);
  const progress = progressByPhase(sorted);
  const template = templates.find((t) => t.id === path.templateId) ?? null;
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
