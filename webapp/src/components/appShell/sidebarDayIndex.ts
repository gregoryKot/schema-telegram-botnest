import type { Need } from '../../types';

/**
 * Индекс дня в сайдбаре — среднее реальных оценок трекера, когда оценены все
 * потребности; иначе `null` (вместо числа — вход в трекер, ничего выдуманного).
 */
export function sidebarDayIndex(needs: Need[], ratings: Record<string, number>): number | null {
  const vals = Object.values(ratings);
  if (needs.length === 0 || vals.length < needs.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}
