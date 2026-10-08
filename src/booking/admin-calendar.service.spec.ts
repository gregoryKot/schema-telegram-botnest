// AdminCalendarService — данные для календаря слотов в админке: правила,
// overrides, брони (с расшифровкой clientName тем же EncryptSchema, что
// BookingService) и занятость календаря. Контракт «Календарь слотов в
// админке». Сборка сетки — buildAdminCalendar (admin-calendar.spec.ts), тут
// проверяется только слой загрузки/расшифровки/метаданных.
import { encryptRecord } from '../utils/crypto';
import { BOOKING_SCHEMA } from './booking.schema';
import { AdminCalendarService } from './admin-calendar.service';
import { calDavHealth } from './caldav-health';

const FROM = '2026-07-13';
const TO = '2026-07-13';

function makeService(opts: {
  rules?: any[];
  overrides?: any[];
  bookings?: any[];
  busy?: { start: Date; end: Date; summary?: string }[];
  calDavEnabled?: boolean;
  blockBusy?: boolean;
}) {
  const prisma: any = {
    availabilityRule: { findMany: jest.fn(async () => opts.rules ?? []) },
    booking: { findMany: jest.fn(async () => opts.bookings ?? []) },
  };
  const overrides = {
    listBetween: jest.fn(async () => opts.overrides ?? []),
  };
  const calDav: any = {
    enabled: opts.calDavEnabled ?? false,
    getBusyTimes: jest.fn(async () => opts.busy ?? []),
  };
  const configMap: Record<string, string> = {};
  if (opts.blockBusy) configMap.CALENDAR_BLOCK_SLOTS = 'true';
  const config = { get: (k: string) => configMap[k] } as any;
  const service = new AdminCalendarService(
    prisma,
    overrides as any,
    calDav,
    config,
  );
  return { service, prisma, overrides, calDav };
}

describe('AdminCalendarService.getCalendar — расшифровка броней', () => {
  it('clientName в ответе открытым текстом, в ячейке нет контакта/сообщения', async () => {
    const row = encryptRecord(
      {
        id: 5,
        startsAt: new Date('2026-07-13T10:00:00Z'),
        durationMin: 50,
        status: 'CONFIRMED',
        clientName: 'Мария',
        clientContact: '+7 900 000-00-00',
        message: 'позвоните вечером',
      },
      BOOKING_SCHEMA,
    );
    const { service } = makeService({ bookings: [row] });
    const cal = await service.getCalendar(FROM, TO);
    const cell = cal.days[0].cells.find(
      (c) => c.startsAt === '2026-07-13T10:00:00.000Z',
    );
    expect(cell?.booking).toEqual({
      id: 5,
      clientName: 'Мария',
      status: 'CONFIRMED',
    });
  });
});

describe('AdminCalendarService.getCalendar — обезличенная бронь', () => {
  const cellAt = (
    cal: Awaited<ReturnType<AdminCalendarService['getCalendar']>>,
  ) => cal.days[0].cells.find((c) => c.startsAt === '2026-07-13T10:00:00.000Z');

  // Крон booking-retention.service.ts стирает имя через 12 месяцев: в БД
  // clientName = '' (encrypt('') отдаёт ''). Без подписи ячейка календаря была
  // бы безымянной и читалась как поломка.
  it('имя стёрто по сроку (пустая строка в БД) — в ячейке подпись «обезличено»', async () => {
    const row = encryptRecord(
      {
        id: 7,
        startsAt: new Date('2026-07-13T10:00:00Z'),
        durationMin: 50,
        status: 'CONFIRMED',
        clientName: '',
        clientContact: '',
        message: null,
        anonymizedAt: new Date('2026-07-14T04:41:00Z'),
      },
      BOOKING_SCHEMA,
    );
    expect(row.clientName).toBe('');
    const { service } = makeService({ bookings: [row] });
    const cal = await service.getCalendar(FROM, TO);
    expect(cellAt(cal)?.booking).toEqual({
      id: 7,
      clientName: 'обезличено',
      status: 'CONFIRMED',
    });
  });

  it('обычное имя не подменяется подписью', async () => {
    const row = encryptRecord(
      {
        id: 8,
        startsAt: new Date('2026-07-13T10:00:00Z'),
        durationMin: 50,
        status: 'HELD',
        clientName: 'Мария',
        clientContact: 'maria@example.com',
        message: null,
      },
      BOOKING_SCHEMA,
    );
    const { service } = makeService({ bookings: [row] });
    const cal = await service.getCalendar(FROM, TO);
    expect(cellAt(cal)?.booking?.clientName).toBe('Мария');
  });
});

describe('AdminCalendarService.getCalendar — CalDAV выключен', () => {
  it('busy не запрашивается, calendarConnected=false', async () => {
    const { service, calDav } = makeService({ calDavEnabled: false });
    const cal = await service.getCalendar(FROM, TO);
    expect(calDav.getBusyTimes).not.toHaveBeenCalled();
    expect(cal.calendarConnected).toBe(false);
  });

  it('CalDAV включён — busy запрашивается, calendarConnected=true', async () => {
    const { service, calDav } = makeService({ calDavEnabled: true });
    const cal = await service.getCalendar(FROM, TO);
    expect(calDav.getBusyTimes).toHaveBeenCalledTimes(1);
    expect(cal.calendarConnected).toBe(true);
  });
});

describe('AdminCalendarService.getCalendar — busyTitle из CalDavService.getBusyTimes', () => {
  it('summary события доезжает до ячейки как busyTitle', async () => {
    const { service } = makeService({
      calDavEnabled: true,
      busy: [
        {
          start: new Date('2026-07-13T10:00:00Z'),
          end: new Date('2026-07-13T11:00:00Z'),
          summary: 'Встреча с Иваном',
        },
      ],
    });
    const cal = await service.getCalendar(FROM, TO);
    const cell = cal.days[0].cells.find(
      (c) => c.startsAt === '2026-07-13T10:00:00.000Z',
    );
    expect(cell?.busyTitle).toBe('Встреча с Иваном');
  });
});

describe('AdminCalendarService.getCalendar — calendarReadError', () => {
  afterEach(() => calDavHealth.reset());

  it('открытая авария чтения календаря прокидывается в ответ', async () => {
    calDavHealth.reset();
    calDavHealth.noteFailure('auth', 'REPORT 403 for https://x/calendars/');
    const { service } = makeService({ calDavEnabled: true });
    const cal = await service.getCalendar(FROM, TO);
    expect(cal.calendarReadError).toBe('REPORT 403 for https://x/calendars/');
  });

  it('без открытой аварии — null', async () => {
    calDavHealth.reset();
    const { service } = makeService({ calDavEnabled: true });
    const cal = await service.getCalendar(FROM, TO);
    expect(cal.calendarReadError).toBeNull();
  });
});

describe('AdminCalendarService.getCalendar — метаданные', () => {
  it('timezone — из первого активного правила, calendarBlocking — из ConfigService', async () => {
    const { service } = makeService({
      rules: [
        {
          dayOfWeek: 1,
          startHour: 9,
          startMinute: 0,
          endHour: 18,
          endMinute: 0,
          sessionDuration: 50,
          bufferMin: 10,
          timezone: 'America/New_York',
          isActive: true,
        },
      ],
      blockBusy: true,
    });
    const cal = await service.getCalendar(FROM, TO);
    expect(cal.timezone).toBe('America/New_York');
    expect(cal.calendarBlocking).toBe(true);
  });

  it('без правил вообще — timezone по умолчанию Europe/Moscow, calendarBlocking=false', async () => {
    const { service } = makeService({});
    const cal = await service.getCalendar(FROM, TO);
    expect(cal.timezone).toBe('Europe/Moscow');
    expect(cal.calendarBlocking).toBe(false);
  });
});
