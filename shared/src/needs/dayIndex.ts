import { isRated } from './ratingRecord';

/**
 * Индекс дня — среднее по всем потребностям; пока не все оценены — null.
 * Одна формула на «Сегодня», «Готово» трекера, колесо истории и мост к терапевту.
 */
export function dayIndex(
  needIds: readonly string[],
  ratings: Record<string, number>,
): number | null {
  if (needIds.length === 0 || needIds.some((id) => !isRated(ratings, id))) {
    return null;
  }
  return needIds.reduce((s, id) => s + ratings[id], 0) / needIds.length;
}

/**
 * Индекс для показа: «6,4» — десятичная запятая; нет индекса — «—». Одна функция
 * на все экраны (QA 2026-11, B-М3: плитка писала «6,4», колесо и сайдбар — «6.4»).
 */
export function fmtIndex(value: number | null | undefined): string {
  return value == null ? '—' : value.toFixed(1).replace('.', ',');
}
/** Отличие индекса со знаком: «+2,0», «−1,5» (типографский минус) — карточка «Обзора» терапевта. */
export const fmtIndexDelta = (delta: number): string =>
  `${delta >= 0 ? '+' : '−'}${fmtIndex(Math.abs(delta))}`;
