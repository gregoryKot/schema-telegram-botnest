// Ближайшая встреча клиента — не в прошлом (webapp ↔ schema-miniapp, правило
// №3). nextSession хранит одну дату, meetingDays (0 = Вс … 6 = Сб) — недельный
// ритм. Дату никто не двигает после встречи, и карточка терапевта показывала
// прошедшую как «следующую» (2026-10: «Сб, 17 окт» при сегодняшнем 26-м), а
// экран «Сегодня» из-за неё не видел встречу по дням. Прошла — переносим на
// ближайший день встреч с тем же временем; дней нет — встречи нет (null).
// Календарный день — полночь UTC (правило №25).
import { dateStringMs, todayCalendarDate } from '../utils/calendarDate';

const DAY_MS = 86_400_000;

export function upcomingSession(
  nextSession: string | null | undefined,
  meetingDays: readonly number[] | null | undefined,
  today: string = todayCalendarDate(),
): string | null {
  if (nextSession && nextSession.slice(0, 10) >= today) return nextSession;
  const days = meetingDays ?? [];
  const time = nextSession?.split('T')[1];
  for (let i = 0; i < 7 && days.length > 0; i++) {
    const day = new Date(dateStringMs(today) + i * DAY_MS);
    if (!days.includes(day.getUTCDay())) continue;
    const ymd = day.toISOString().slice(0, 10);
    return time ? `${ymd}T${time}` : ymd;
  }
  return null;
}
