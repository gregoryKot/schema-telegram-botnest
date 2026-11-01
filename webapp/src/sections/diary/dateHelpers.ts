// Хелперы дат таймлайна дневника. Вынесено из DiarySection.tsx (правило №10).
// «Сегодня» и день записи — местный день человека (shared/src/diary/diaryDay.ts).
import { dateStringMs, dateStringParts } from '../../../../shared/src/utils/calendarDate';
import { fmtDateLong } from '../../../../shared/src/utils/format';
import { diaryDayKey, diaryToday } from '../../../../shared/src/diary/diaryDay';

const WEEKDAYS = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'];

export function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
}
/** День записи по моменту `createdAt` — местный, а не гринвичский срез строки. */
export const fmtDateKey = diaryDayKey;
/** «27 октября» из календарного дня `YYYY-MM-DD`. */
export const fmtDayMonth = fmtDateLong;
export function fmtWeekday(dateStr: string) {
  const parts = dateStringParts(dateStr);
  return parts ? WEEKDAYS[parts.weekday] : '';
}
export function dateRelLabel(dateStr: string, today: string = diaryToday()) {
  const diff = Math.round((dateStringMs(today) - dateStringMs(dateStr)) / 86400000);
  if (diff === 0) return 'сегодня';
  if (diff === 1) return 'вчера';
  if (diff < 7) return `${diff} дн. назад`;
  return null;
}
