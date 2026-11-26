// Центр колеса потребностей в истории трекера (shared/src/components/NeedsWheel).
// Раньше колесо делило сумму оценок на пять, считая пропуск нулём: пустой
// день показывал «индекс 0.0 ↓ вчера 6.0» — падение, которого не было
// (QA 2026-11, B-З6). Теперь индекс — та же формула, что на плитке и в итоге
// трекера (dayIndex: пока оценены не все, индекса нет), и тот же формат.
import { dayIndex, fmtIndex } from '../needs/dayIndex';

export interface WheelCenter {
  /** «6,4» или «—», если день заполнен не целиком. */
  index: string;
  /** «↑ вчера 5,8»; null, если вчерашнего индекса нет. */
  prev: string | null;
}

// В истории оценка 0 — «не заполнено»: строки потребностей рисуют её «–».
const filled = (r: Record<string, number>): Record<string, number> =>
  Object.fromEntries(Object.entries(r).filter(([, v]) => v > 0));

export function wheelCenter(
  needIds: readonly string[],
  ratings: Record<string, number>,
  prevRatings: Record<string, number> = {},
): WheelCenter {
  const idx = dayIndex(needIds, filled(ratings));
  const prev = dayIndex(needIds, filled(prevRatings));
  if (prev === null) return { index: fmtIndex(idx), prev: null };
  const arrow = idx === null || idx === prev ? '' : idx > prev ? '↑ ' : '↓ ';
  return { index: fmtIndex(idx), prev: `${arrow}вчера ${fmtIndex(prev)}` };
}
