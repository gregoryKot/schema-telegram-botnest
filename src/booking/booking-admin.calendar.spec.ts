// Регресс инцидента 2026-09-13: админка отвечала «связь с календарём есть»,
// хотя чтение занятости падало (403 в корень) — калD DAV показывался вкл, а
// слоты тихо шли поверх личных встреч. calendarReadError обязан отражать
// реальное состояние calDavHealth, а не просто факт "enabled".
import { buildCalendarStatus } from './booking-admin.calendar';
import { calDavHealth } from './caldav-health';

function fakeCalDav(overrides: Record<string, unknown> = {}) {
  return {
    enabled: true,
    getBusyTimes: jest.fn().mockResolvedValue([]),
    debugCalendars: jest.fn().mockResolvedValue(['Основной']),
    ...overrides,
  } as any;
}

describe('buildCalendarStatus', () => {
  afterEach(() => calDavHealth.reset());

  it('CalDAV выключен — пустой статус без ошибки чтения', async () => {
    const status = await buildCalendarStatus(fakeCalDav({ enabled: false }));
    expect(status).toEqual({
      appleCalendar: false,
      calendarBusyCount: null,
      calendarNames: [],
      calendarReadError: null,
    });
  });

  it('CalDAV включен, авария не открыта — calendarReadError: null', async () => {
    const calDav = fakeCalDav({
      getBusyTimes: jest.fn().mockResolvedValue([{}, {}]),
    });
    const status = await buildCalendarStatus(calDav);
    expect(status.appleCalendar).toBe(true);
    expect(status.calendarBusyCount).toBe(2);
    expect(status.calendarNames).toEqual(['Основной']);
    expect(status.calendarReadError).toBeNull();
  });

  it('авария открыта (getBusyTimes провалился) — calendarReadError несёт подробность сбоя', async () => {
    // Настоящий CalDavService пишет в calDavHealth ВНУТРИ getBusyTimes —
    // здесь мок молчит, поэтому фиксируем то же состояние напрямую.
    calDavHealth.noteFailure('auth', 'REPORT 403 for https://x/calendars/');
    const status = await buildCalendarStatus(fakeCalDav());
    expect(status.calendarReadError).toBe(
      'REPORT 403 for https://x/calendars/',
    );
  });

  it('авария была, но уже закрыта успехом — calendarReadError снова null', async () => {
    calDavHealth.noteFailure('timeout', 'aborted');
    calDavHealth.noteFailure('timeout', 'aborted'); // второй подряд открывает
    calDavHealth.noteSuccess();
    const status = await buildCalendarStatus(fakeCalDav());
    expect(status.calendarReadError).toBeNull();
  });
});
