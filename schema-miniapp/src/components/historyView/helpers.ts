import { Need, DayHistory } from '../../types';

export const DOW_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
export const TODAY_STR = new Date().toISOString().split('T')[0];
export const SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)';
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

export function petalPath(
  cx: number,
  cy: number,
  r: number,
  ca: number,
  hs: number,
): string {
  if (r < 1) return '';
  const a1 = ca - hs,
    a2 = ca + hs;
  const x1 = cx + r * Math.cos(a1),
    y1 = cy + r * Math.sin(a1);
  const x2 = cx + r * Math.cos(a2),
    y2 = cy + r * Math.sin(a2);
  return `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
}
export function arcPath2(
  cx: number,
  cy: number,
  r: number,
  ca: number,
  hs: number,
): string {
  const a1 = ca - hs,
    a2 = ca + hs;
  const x1 = cx + r * Math.cos(a1),
    y1 = cy + r * Math.sin(a1);
  const x2 = cx + r * Math.cos(a2),
    y2 = cy + r * Math.sin(a2);
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}
