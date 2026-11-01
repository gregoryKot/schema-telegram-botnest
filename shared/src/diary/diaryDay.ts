import { localDateStr } from '../utils/format';
import { momentDayKey } from '../utils/momentDate';

// День записи дневника — день ЧЕЛОВЕКА, а не Гринвича. Инцидент 2026-10-26:
// «сегодня» дневника бралось `toISOString()` при загрузке бандла, и
// благодарность, записанная в 00:19 по Москве, получала дату 26.10 (по Москве
// уже 27-е); шапка листа и архив подписывали запись вторника «сегодня ·
// понедельник».
//
// Дата благодарности выбирается местным днём в момент записи, а дальше живёт
// календарным днём `YYYY-MM-DD` без зоны и показывается как есть (правило №25).
// Записи схем и режимов хранят момент (`createdAt`) — их день тоже местный.
// Поэтому «сегодня» здесь — не `todayCalendarDate()` (UTC, им сверяют дни
// сервера), и считается при каждом вызове, а не один раз на загрузку.

/** Сегодня для записи дневника — местный день человека. */
export function diaryToday(now: Date = new Date()): string {
  return localDateStr(now);
}

/** День записи: дата благодарности — как есть, момент `createdAt` — местным днём. */
export function diaryDayKey(value: string): string {
  return momentDayKey(value);
}

/** Запись дневника сделана сегодня по местному дню человека. */
export function isDiaryToday(value: string, now: Date = new Date()): boolean {
  const key = diaryDayKey(value);
  return key !== '' && key === diaryToday(now);
}
