import { DayHistory, Need } from '../../types';

export const DOW_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
export const TODAY_STR = new Date().toISOString().split('T')[0];
export const HISTORY_HINT_KEY = 'history_hint_dismissed';
export const DAYS_OPTIONS = [7, 14, 30];

export function getDayAbbr(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return DOW_SHORT[new Date(y, m - 1, d).getDay()];
}
export function getDayNum(dateStr: string): string {
  return String(parseInt(dateStr.split('-')[2]));
}
export function dayAvg(day: DayHistory, needs: Need[]): number | null {
  const vals = needs.map((n) => day.ratings[n.id] ?? 0).filter((v) => v > 0);
  if (vals.length === 0) return null;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}
