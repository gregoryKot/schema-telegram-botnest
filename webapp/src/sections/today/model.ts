import { isCalendarDate } from '../../../../shared/src/utils/calendarDate';

// Чистые вычисления экрана «Сегодня»: момент встречи. Индекс дня —
// shared/src/needs/dayIndex.ts; лента дня и мета плиток — todayFeed.ts;
// тип записи и ярлык — sections/diary/entryKind.ts.

// ── Встреча с терапевтом ────────────────────────────────────────────────────

/** Момент встречи для показа. Только день (`2026-10-31` — дни встреч без
 * времени) — местная полночь: `new Date('2026-10-31')` дал бы полночь UTC,
 * то есть «· 03:00» в Москве и прошлый день западнее Гринвича. */
export function sessionMoment(value: string): Date {
  if (!isCalendarDate(value)) return new Date(value);
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}
