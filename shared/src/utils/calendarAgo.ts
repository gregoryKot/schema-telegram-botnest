// «вчера» / «N дн. назад» / «3 окт» для КАЛЕНДАРНОГО дня (`YYYY-MM-DD`).
// Пара к fmtAgo (format.ts), который для моментов: у календарного дня зоны нет,
// поэтому разница считается между двумя полночами UTC, а дата старше недели —
// через fmtDate, без пересчёта в зону читателя (правило №25: иначе в
// Лос-Анджелесе «3 окт» показывалось бы «2 окт»).
import { dateStringMs } from './calendarDate';
import { fmtDate } from './format';

/** Сколько календарных дней от day до today (оба — `YYYY-MM-DD`). */
export const calendarDaysAgo = (day: string, today: string): number =>
  Math.round((dateStringMs(today) - dateStringMs(day)) / 86_400_000);

/** «сегодня» / «вчера» / «N дн. назад» (до недели) / «3 окт»; мусор — ''. */
export function calendarAgoLabel(day: string, today: string): string {
  const days = calendarDaysAgo(day, today);
  if (Number.isNaN(days)) return '';
  if (days === 0) return 'сегодня';
  if (days === 1) return 'вчера';
  if (days > 1 && days < 7) return `${days} дн. назад`;
  return fmtDate(day);
}
