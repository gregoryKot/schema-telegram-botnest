import type { DayHistory } from '../../../../shared/src/types';
import { NEED_COLOR_ORDER } from '../../../../shared/src/needs/needColors';
import { fmtIndex, trackerSummary } from '../today/todayFeed';

// Строки трекера для ленты «Записи»: по дню одна — индекс, если оценены все потребности,
// иначе «N из M». Дни без единой оценки не показываются (нет данных — нет строки).

export interface TrackerDay { date: string; filled: number; total: number; index: number | null }

const NEED_IDS: string[] = [...NEED_COLOR_ORDER];

/** История оценок (`/api/history`) → дни с хотя бы одной оценкой. */
export function buildTrackerDays(history: DayHistory[], needIds: string[] = NEED_IDS): TrackerDay[] {
  return history
    .map((h) => ({ date: h.date, ...trackerSummary(needIds, h.ratings) }))
    .filter((d) => d.filled > 0);
}

/** «Трекер — индекс 7,2» или «Трекер: 3 из 5». */
export function trackerDayLabel(d: TrackerDay): string {
  return d.index !== null && d.filled >= d.total
    ? `Трекер — индекс ${fmtIndex(d.index)}`
    : `Трекер: ${d.filled} из ${d.total}`;
}
