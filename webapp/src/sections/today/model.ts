import { isCalendarDate } from '../../../../shared/src/utils/calendarDate';

// Чистые вычисления экрана «Сегодня»: индекс дня, типы
// дневников, момент встречи. Лента дня и мета плиток — todayFeed.ts.

// ── Потребности: индекс дня ─────────────────────────────────

/** Индекс дня — среднее по всем потребностям; пока не все оценены — null (не выдумываем число). */
export function dayIndex(needIds: string[], ratings: Record<string, number>): number | null {
  if (needIds.length === 0 || needIds.some(id => ratings[id] === undefined)) return null;
  return needIds.reduce((s, id) => s + ratings[id], 0) / needIds.length;
}

export type DiaryKind = 'schema' | 'mode' | 'gratitude';

export const DIARY_KIND_LABEL: Record<DiaryKind, string> = {
  schema: 'Схема', mode: 'Режим', gratitude: 'Благодарность',
};

// ── Встреча с терапевтом ────────────────────────────────────────────────────

/** Момент встречи для показа. Только день (`2026-10-31` — дни встреч без
 * времени) — местная полночь: `new Date('2026-10-31')` дал бы полночь UTC,
 * то есть «· 03:00» в Москве и прошлый день западнее Гринвича. */
export function sessionMoment(value: string): Date {
  if (!isCalendarDate(value)) return new Date(value);
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}
