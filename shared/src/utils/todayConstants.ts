import { localDateStr, todayStr } from './format';
import type { DayHistory } from '../types';

// Константы «сегодня/вчера» на момент загрузки бандла — единственная копия
// (правило №3; жили дублем в schema-miniapp/utils/todayConstants.ts и
// webapp/appShell/useBootstrapLoad.ts).
export const TODAY_DATE = todayStr();
export const TODAY_KEY = 'celebrated_' + TODAY_DATE;
export const YESTERDAY_DATE = (() => {
  const [y, m, d] = TODAY_DATE.split('-').map(Number);
  return localDateStr(new Date(y, m - 1, d - 1));
})();

// Заполнение дырок в истории трекера пустыми днями (read-after-write: сервер
// хранит только дни с оценками, экраны истории показывают ровный календарь).
// Раньше жила дублем в webapp/AppShell.tsx и schema-miniapp/todayConstants.ts
// (правило №3, свип jscpd 2026-08) — единственная копия, оба фронтенда
// импортируют отсюда.
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
    // localDateStr, а НЕ toISOString(): TODAY_DATE выше считается по
    // локальной зоне, и в зонах, где локальная дата уже другая (UTC+10
    // после полудня UTC), UTC-курсор давал «вчера», равное локальному
    // сегодня — день выпадал из календаря истории, а тест падал только в
    // те часы, когда даты расходятся (джоба TZ=Australia/Sydney, правило
    // про TZ-тесты в CLAUDE.md).
    const date = localDateStr(cursor);
    if (date < earliest) break;
    filled.push(byDate.get(date) ?? { date, ratings: {} });
    cursor.setDate(cursor.getDate() - 1);
  }
  return filled;
}
