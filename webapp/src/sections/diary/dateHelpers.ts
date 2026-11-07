// Хелперы дат таймлайна дневника. Вынесено из DiarySection.tsx (правило №10).
// «Сегодня» и день записи — местный день человека (shared/src/diary/diaryDay.ts).
import { dateStringParts } from '../../../../shared/src/utils/calendarDate';
import { calendarAgoLabel, calendarDaysAgo } from '../../../../shared/src/utils/calendarAgo';
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
/** «сегодня» / «вчера» / «N дн. назад» в пределах недели, дальше — null. */
export const dateRelLabel = (dateStr: string, today: string = diaryToday()) =>
  calendarDaysAgo(dateStr, today) < 7 ? calendarAgoLabel(dateStr, today) : null;
