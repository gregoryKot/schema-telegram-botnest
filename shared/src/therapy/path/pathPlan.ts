// Чистая логика пути клиента (#1522): фазы из шаблона, плановые даты, «мы здесь», расхождение с планом,
// прогресс фазы. Дни — календарные `YYYY-MM-DD` (полночь UTC, правило №25); «сегодня» передаёт вызывающий.
import { dateStringMs, shiftCalendarDay } from '../../utils/calendarDate';
import type { PlanStatus } from '../plan/planItem';
import type { PathPhase, PathPhaseDraft } from './pathModel';
import type { PathTemplate } from './templates';

const WEEK_MS = 7 * 86_400_000;

/** Фазы нового пути из шаблона: название, цель и срок — как в шаблоне, дальше их правят. */
export function phaseDraftsFromTemplate(
  template: PathTemplate,
): PathPhaseDraft[] {
  return template.phases.map((p) => ({
    name: p.name,
    goal: p.goal,
    weeks: p.weeks,
    templatePhaseId: p.id,
  }));
}

export interface PhaseDates {
  /** Первый день фазы по плану. */
  start: string;
  /** День, с которого по плану идёт следующая фаза (сам в фазу не входит). */
  end: string;
}

/** Плановые даты фаз от старта пути: сроки идут подряд, поэтому сдвиг одной фазы двигает следующие. */
export function phaseDates(
  startDate: string,
  phases: readonly Pick<PathPhase, 'weeks'>[],
): PhaseDates[] {
  let start = startDate;
  return phases.map((p) => {
    const end = shiftCalendarDay(start, p.weeks * 7);
    const dates = { start, end };
    start = end;
    return dates;
  });
}

/** Плановый конец пути; без фаз — день старта. */
export function pathEndDate(
  startDate: string,
  phases: readonly Pick<PathPhase, 'weeks'>[],
): string {
  return phaseDates(startDate, phases).at(-1)?.end ?? startDate;
}

type PhaseMarks = Pick<PathPhase, 'startedAt' | 'endedAt'>;

/** «Мы здесь»: последняя начатая и не законченная фаза; такой нет — -1. */
export function currentPhaseIndex(phases: readonly PhaseMarks[]): number {
  for (let i = phases.length - 1; i >= 0; i -= 1)
    if (phases[i].startedAt != null && phases[i].endedAt == null) return i;
  return -1;
}

/** Куда переходить дальше: первая не начатая фаза после текущей (или с начала пути); нет — -1. */
export function nextPhaseIndex(phases: readonly PhaseMarks[]): number {
  const from = currentPhaseIndex(phases) + 1;
  const i = phases
    .slice(from)
    .findIndex((p) => p.startedAt == null && p.endedAt == null);
  return i < 0 ? -1 : from + i;
}

/** Сколько полных недель прошло после планового конца; ещё не прошёл или меньше недели — 0. */
export function overdueWeeks(plannedEnd: string, today: string): number {
  const weeks = Math.floor(
    (dateStringMs(today) - dateStringMs(plannedEnd)) / WEEK_MS,
  );
  return weeks > 0 ? weeks : 0;
}

export interface PhaseOverdue {
  /** Номер текущей фазы в пути. */
  index: number;
  /** «По плану эта фаза закончилась N недель назад». */
  weeks: number;
  /** Срок фазы, при котором её плановый конец не раньше сегодня: «сдвинуть сроки». */
  catchUpWeeks: number;
}

/** Расхождение с планом у текущей фазы; идём по плану или текущей фазы нет — null. */
export function currentPhaseOverdue(
  startDate: string,
  phases: readonly (PhaseMarks & Pick<PathPhase, 'weeks'>)[],
  today: string,
): PhaseOverdue | null {
  const index = currentPhaseIndex(phases);
  if (index < 0) return null;
  const { start, end } = phaseDates(startDate, phases)[index];
  const weeks = overdueWeeks(end, today);
  if (weeks === 0) return null;
  const catchUpWeeks = Math.ceil(
    (dateStringMs(today) - dateStringMs(start)) / WEEK_MS,
  );
  return { index, weeks, catchUpWeeks };
}

export interface PhaseProgress extends Record<PlanStatus, number> {
  /** Пункты в счёте: все, кроме «не нужно». */
  total: number;
  /** Доля сделанного от `total`; считать не из чего — null. */
  share: number | null;
}

/** Прогресс фазы по статусам её пунктов; неизвестный статус читается как «намечено». */
export function phaseProgress(
  items: readonly { status: string }[],
): PhaseProgress {
  const counts: Record<PlanStatus, number> = {
    planned: 0,
    active: 0,
    done: 0,
    postponed: 0,
    dropped: 0,
  };
  for (const i of items)
    counts[i.status in counts ? (i.status as PlanStatus) : 'planned'] += 1;
  const total = items.length - counts.dropped;
  return { ...counts, total, share: total > 0 ? counts.done / total : null };
}

/** Прогресс по каждой фазе пути; ключ null — пункты «Без фазы». */
export function progressByPhase(
  items: readonly { phaseId: number | null; status: string }[],
): Map<number | null, PhaseProgress> {
  const groups = new Map<number | null, { status: string }[]>();
  for (const i of items)
    groups.set(i.phaseId, [...(groups.get(i.phaseId) ?? []), i]);
  return new Map([...groups].map(([id, list]) => [id, phaseProgress(list)]));
}
