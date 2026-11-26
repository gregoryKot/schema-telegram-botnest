// Дни еженедельных встреч клиента (0 = воскресенье … 6 = суббота, как Date.getDay()
// и `meetingDays` в API). Порядок показа — с понедельника: так в мини-аппе
// (therapistClientSheet/SessionCard) и на сайте (правило №3).
export const MEETING_DAYS_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

/** Отметить/снять день; результат всегда в порядке недели, без повторов. */
export function toggleMeetingDay(
  days: readonly number[],
  day: number,
): number[] {
  const next = days.includes(day)
    ? days.filter((d) => d !== day)
    : [...days, day];
  return sortMeetingDays(next);
}

/** Дни недели в порядке «Пн … Вс», дубли и значения вне 0–6 отброшены. */
export function sortMeetingDays(days: readonly number[]): number[] {
  return MEETING_DAYS_ORDER.filter((d) => days.includes(d));
}
