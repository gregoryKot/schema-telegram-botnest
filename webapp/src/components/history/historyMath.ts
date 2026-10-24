import type { Need, DayHistory } from '../../types';

const DOW_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

export function getDayAbbr(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return DOW_SHORT[new Date(y, m - 1, d).getDay()];
}

export function getDayNum(dateStr: string): string {
  return String(parseInt(dateStr.split('-')[2]));
}

export function dayAvg(day: DayHistory, needs: Need[]): number | null {
  const vals = needs.map(n => day.ratings[n.id] ?? 0).filter(v => v > 0);
  if (vals.length === 0) return null;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

/** Уровень среднего за день: ≥7 — ok, ≥4 — warn, ниже — err. */
export function dayLevel(avg: number): 'ok' | 'warn' | 'err' {
  return avg >= 7 ? 'ok' : avg >= 4 ? 'warn' : 'err';
}

/** Подпись оценки потребности и её уровень. */
export function needLevel(val: number): { label: string; level: 'ok' | 'warn' | 'err' } | null {
  if (val === 0) return null;
  if (val <= 3) return { label: 'низко', level: 'err' };
  if (val <= 6) return { label: 'средне', level: 'warn' };
  return { label: 'хорошо', level: 'ok' };
}
