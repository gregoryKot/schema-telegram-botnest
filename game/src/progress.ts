// Прогресс игрока в localStorage: какая глава достигнута.
// Хранится самая дальняя — закрыл вкладку, вернулся, продолжил с неё.
const KEY = 'rtym_chapter';
const ORDER = ['chapter1', 'chapter2', 'chapter3', 'chapter4'];

export function unlockChapter(id: string) {
  try {
    const cur = localStorage.getItem(KEY);
    if (!cur || ORDER.indexOf(id) > ORDER.indexOf(cur)) localStorage.setItem(KEY, id);
  } catch { /* приватный режим — играем без сохранения */ }
}

/** Глава для «продолжить», или null если прогресса нет / он в самом начале */
export function getContinueChapter(): string | null {
  try {
    const cur = localStorage.getItem(KEY);
    return cur && ORDER.includes(cur) ? cur : null;
  } catch { return null; }
}

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
