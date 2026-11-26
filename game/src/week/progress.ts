// «Неделя»: какие дни пройдены — заставка дня говорит «уже пройден, можно ещё раз».
const WEEK_KEY = 'week_done';
const readWeek = (): string[] => {
  try { const v = JSON.parse(localStorage.getItem(WEEK_KEY) ?? '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
};
export function markWeekDone(day: string) {
  const done = readWeek();
  if (done.includes(day)) return;
  try { localStorage.setItem(WEEK_KEY, JSON.stringify([...done, day])); } catch { /* приватный режим */ }
}
export const isWeekDone = (day: string): boolean => readWeek().includes(day);
