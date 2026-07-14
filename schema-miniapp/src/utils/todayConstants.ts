import { todayStr } from './format';
import { DayHistory } from '../types';

// Вынесено из App.tsx (этап 3 REMEDIATION_PLAN) — используется и в App.tsx,
// и в TrackerHistoryOverlay.tsx, без циклического импорта между ними.
export const TODAY_DATE = todayStr();
export const TODAY_KEY = 'celebrated_' + TODAY_DATE;
export const HAS_HISTORY = Object.keys(localStorage).some(
  (k) => k.startsWith('celebrated_') && k !== TODAY_KEY,
);
export const YESTERDAY_DATE = (() => {
  const [y, m, d] = TODAY_DATE.split('-').map(Number);
  const prev = new Date(y, m - 1, d - 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(prev.getDate()).padStart(2, '0')}`;
})();

export function fillHistoryGaps(h: DayHistory[]): DayHistory[] {
  if (h.length === 0) return h;
  const byDate = new Map(h.map((d) => [d.date, d]));
  const todayEntry = h.find((d) => d.date === TODAY_DATE);
  const nonToday = h.filter((d) => d.date !== TODAY_DATE);
  if (nonToday.length === 0) return h;
  const earliest = nonToday[nonToday.length - 1].date;
  const filled: DayHistory[] = todayEntry ? [todayEntry] : [];
  const cursor = new Date();
  cursor.setDate(cursor.getDate() - 1); // start from yesterday
  for (let i = 0; i < 60; i++) {
    const date = cursor.toISOString().split('T')[0];
    if (date < earliest) break;
    filled.push(byDate.get(date) ?? { date, ratings: {} });
    cursor.setDate(cursor.getDate() - 1);
  }
  return filled;
}
