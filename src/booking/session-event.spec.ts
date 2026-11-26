// Решение владельца Р6 (2026-11-08, аудит 2026-11 R9): знакомство INTRO_15
// подписано «15 минут» (SESSION_META), а событие в календаре владельца, .ics
// клиента и страница записи показывали длину слота сетки (50). Теперь событие
// длится 15 минут от начала по сетке; занятость слота (Booking.durationMin)
// не меняется — сетка не открывает пересекающийся слот.
import { BookingStatus, SessionType } from '@prisma/client';
import { eventDurationMin } from './session-event';
import { buildBookingIcsText } from './booking-ics';
import { getPublicBookingByToken } from './booking-public-view';
import { runConfirmEffects } from './booking-confirm-run';
import { isOccupied } from './slot-filters';

const START = new Date('2026-12-14T09:00:00Z');
const INTRO = {
  id: 7,
  startsAt: START,
  durationMin: 50, // длина слота правила — так бронь и хранится
  type: SessionType.INTRO_15,
  status: BookingStatus.CONFIRMED,
  paidAt: null,
  cancelToken: 'tok-intro',
};
const prismaWith = (row: unknown) =>
  ({ booking: { findUnique: jest.fn(async () => row) } }) as never;

describe('eventDurationMin', () => {
  it.each([
    [SessionType.INTRO_15, 50, 15],
    [SessionType.INTRO_15, 15, 15],
    [SessionType.SESSION_50, 50, 50],
    [SessionType.SESSION_50, 60, 60],
  ])('%s в слоте %i мин → событие %i мин', (type, slot, event) => {
    expect(eventDurationMin({ type, durationMin: slot })).toBe(event);
  });
});

describe('событие знакомства — 15 минут во всех местах, где видна длина', () => {
  it('.ics клиента: DTEND = начало + 15 минут', async () => {
    const ics = await buildBookingIcsText(
      prismaWith(INTRO),
      'tok',
      'https://x',
    );
    expect(ics).toContain('DTSTART:20261214T090000Z');
    expect(ics).toContain('DTEND:20261214T091500Z');
  });

  it('страница записи: durationMin 15, endsAt = начало + 15 минут', async () => {
    const view = await getPublicBookingByToken(prismaWith(INTRO), 'tok');
    expect(view.durationMin).toBe(15);
    expect(view.endsAt).toBe('2026-12-14T09:15:00.000Z');
  });

  it('календарь владельца (CalDAV): событие 15 минут', async () => {
    const pushEvent = jest.fn(async () => 'uid');
    const prisma = {
      booking: {
        update: jest.fn(async () => ({})),
        findUnique: jest.fn(async () => ({ status: BookingStatus.CONFIRMED })),
        updateMany: jest.fn(async () => ({ count: 1 })),
      },
    };
    await runConfirmEffects(
      {
        prisma: prisma as never,
        meeting: {
          createMeeting: jest.fn(async () => ({
            url: 'https://m',
            replaced: false,
          })),
        } as never,
        calDav: { enabled: true, pushEvent } as never,
        notifyAdminBoth: jest.fn(async () => undefined),
      },
      {
        ...INTRO,
        clientName: 'Мария',
        clientContact: '@maria',
        message: null,
        meetingUrl: null,
      },
    );
    expect(pushEvent).toHaveBeenCalledWith(
      expect.objectContaining({ startsAt: START, durationMin: 15 }),
    );
  });

  it('КОНТРОЛЬ: сессия — событие во весь слот', async () => {
    const row = { ...INTRO, type: SessionType.SESSION_50 };
    const view = await getPublicBookingByToken(prismaWith(row), 'tok');
    expect(view.durationMin).toBe(50);
  });

  it('занятость сетки не меняется: бронь знакомства держит весь слот', () => {
    // Слот 09:30 внутри 50-минутного слота знакомства по-прежнему занят.
    const inner = new Date('2026-12-14T09:30:00Z');
    const innerEnd = new Date('2026-12-14T10:20:00Z');
    expect(isOccupied(inner, innerEnd, [INTRO])).toBe(true);
  });
});
