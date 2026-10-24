// Календарная часть /admin/status — вынесена из booking-admin.controller.ts
// (правило №10: потолок файла), заодно даёт отдельную точку для юнит-теста
// без поднятия всего контроллера.
import { CalDavService } from './caldav.service';
import { calDavHealth } from './caldav-health';

export interface CalendarStatus {
  appleCalendar: boolean;
  calendarBusyCount: number | null;
  calendarNames: string[];
  // Инцидент 2026-09-13: админка показывала «связь есть», хотя чтение
  // занятости падало — слоты тихо шли поверх личных встреч. null, пока
  // авария не открыта calDavHealth (см. правило №14).
  calendarReadError: string | null;
}

const EMPTY: CalendarStatus = {
  appleCalendar: false,
  calendarBusyCount: null,
  calendarNames: [],
  calendarReadError: null,
};

/** Занятость за 14 дней, список календарей и текущая ошибка чтения (если авария открыта). */
export async function buildCalendarStatus(
  calDav: CalDavService,
): Promise<CalendarStatus> {
  if (!calDav.enabled) return EMPTY;
  const now = new Date();
  const [busy, names] = await Promise.all([
    calDav.getBusyTimes(now, new Date(now.getTime() + 14 * 86_400_000)),
    calDav.debugCalendars(),
  ]);
  // Снимок ПОСЛЕ getBusyTimes — он же обновляет calDavHealth при сбое/успехе.
  const snap = calDavHealth.snapshot();
  return {
    appleCalendar: true,
    calendarBusyCount: busy.length,
    calendarNames: names,
    calendarReadError: snap.open ? snap.lastFailDetail : null,
  };
}
