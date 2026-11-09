import type { DayHistory } from '../../../../shared/src/types';
import { NEED_COLOR_ORDER } from '../../../../shared/src/needs/needColors';
import { dayStrokeValues } from '../../../../shared/src/needs/dayStrokes';
import { trackerSummary } from '../today/todayFeedModel';
import { fmtIndex } from '../../../../shared/src/needs/dayIndex';

// Трекер дня в ленте «Записи» — полоски дня в строке даты (DayHead): индекс, если оценены все
// потребности, иначе «N из M»; `values` — оценки для Strokes values, как на главной. Дни без единой оценки не показываются.
export interface TrackerDay { date: string; filled: number; total: number; index: number | null; values: (number | null)[] }
const NEED_IDS: string[] = [...NEED_COLOR_ORDER];

/** История оценок (`/api/history`) → дни с хотя бы одной оценкой. */
export function buildTrackerDays(history: DayHistory[], needIds: string[] = NEED_IDS): TrackerDay[] {
  return history
    .map((h) => ({ date: h.date, ...trackerSummary(needIds, h.ratings), values: dayStrokeValues(h.ratings) }))
    .filter((d) => d.filled > 0);
}

const complete = (d: TrackerDay) => d.index !== null && d.filled >= d.total;
/** «Трекер — индекс 7,2» или «Трекер: 3 из 5» — имя кнопки строки дня. */
export const trackerDayLabel = (d: TrackerDay): string =>
  complete(d) ? `Трекер — индекс ${fmtIndex(d.index!)}` : `Трекер: ${d.filled} из ${d.total}`;
/** Та же цифра без слова «Трекер» — рядом с полосками дня, знак трекера и есть подпись. */
export const trackerDayValue = (d: TrackerDay): string =>
  complete(d) ? `индекс ${fmtIndex(d.index!)}` : `${d.filled} из ${d.total}`;
