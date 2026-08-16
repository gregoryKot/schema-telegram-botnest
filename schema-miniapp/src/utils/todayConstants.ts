import { DayHistory } from '../types';

// Вынесено из App.tsx (этап 3 REMEDIATION_PLAN) — используется и в App.tsx,
// и в TrackerHistoryOverlay.tsx, без циклического импорта между ними.
export {
  TODAY_DATE,
  TODAY_KEY,
  YESTERDAY_DATE,
} from '../../../shared/src/utils/todayConstants';
import {
  TODAY_DATE,
  TODAY_KEY,
} from '../../../shared/src/utils/todayConstants';
export const HAS_HISTORY = Object.keys(localStorage).some(
  (k) => k.startsWith('celebrated_') && k !== TODAY_KEY,
);
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
