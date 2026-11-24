// Плановые даты фаз пути клиента (#1522): сроки идут подряд от старта пути; календарные дни — правило №25.
import { shiftCalendarDay } from '../../utils/calendarDate';
import type { PathPhase } from './pathModel';

export interface PhaseDates {
  /** Первый день фазы по плану. */
  start: string;
  /** День, с которого по плану идёт следующая фаза (сам в фазу не входит). */
  end: string;
}

/**
 * Плановые даты фаз от старта пути: сроки идут подряд, поэтому сдвиг одной фазы двигает следующие.
 * Фаза без срока, как и всё после неё, дат не имеет — null: конец неизвестен, начало следующей тоже.
 */
export function phaseDates(
  startDate: string,
  phases: readonly Pick<PathPhase, 'weeks'>[],
): (PhaseDates | null)[] {
  let start: string | null = startDate;
  return phases.map((p) => {
    if (start == null || p.weeks == null) {
      start = null;
      return null;
    }
    const end = shiftCalendarDay(start, p.weeks * 7);
    const dates = { start, end };
    start = end;
    return dates;
  });
}

/** Плановый конец пути; без фаз — день старта; срока нет у какой-то фазы — null. */
export function pathEndDate(
  startDate: string,
  phases: readonly Pick<PathPhase, 'weeks'>[],
): string | null {
  const dates = phaseDates(startDate, phases);
  return dates.length === 0 ? startDate : (dates.at(-1)?.end ?? null);
}
