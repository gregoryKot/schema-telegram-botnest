import { isRated } from './ratingRecord';

/** Сколько последних дней подряд потребность должна быть низкой, чтобы это было «не первый день». */
export const PERSISTENT_LOW_DAYS = 3;
/** Оценка «низко»: 4 и ниже по шкале 0–10. */
export const LOW_RATING = 4;

/**
 * Потребности, оценённые низко во все последние PERSISTENT_LOW_DAYS дней (дни — от нового к старому).
 * Одна формула на «Историю» (день и неделя) и экран «Готово» трекера.
 */
export function persistentLowNeeds<T extends { id: string }>(
  needs: readonly T[],
  days: ReadonlyArray<{ ratings: Record<string, number> }>,
): T[] {
  if (days.length < PERSISTENT_LOW_DAYS) return [];
  const recent = days.slice(0, PERSISTENT_LOW_DAYS);
  return needs.filter((n) => recent.every((d) => isRated(d.ratings, n.id) && d.ratings[n.id] <= LOW_RATING));
}
