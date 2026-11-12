import { Booking, BookingStatus } from '@prisma/client';
import { cancelEventUid, claimCancel } from './booking.transitions';
import { bookingEventUid } from './caldav-owner-event';

// Какое событие календаря снимать после отмены (аудит 2026-10-11): у HELD
// события нет, у CONFIRMED без записанного uid (под умер между PUT и записью)
// оно есть и снимается по детерминированному uid брони.
const fresh = (over: Partial<Booking> = {}) => ({
  id: 7,
  calDavUid: null,
  paidAt: null,
  meetingUrl: null,
  ...over,
});

describe('cancelEventUid', () => {
  it('записанный uid — как есть, статус не важен', () => {
    expect(
      cancelEventUid(
        { status: BookingStatus.HELD },
        fresh({ calDavUid: 'cal-7' }),
      ),
    ).toBe('cal-7');
  });

  it('CONFIRMED без записанного uid → детерминированный uid брони', () => {
    expect(cancelEventUid({ status: BookingStatus.CONFIRMED }, fresh())).toBe(
      'booking-7@schemehappens.ru',
    );
  });

  it('HELD без записанного uid, оплаты и ссылки → null: события не бывает, DELETE не нужен', () => {
    expect(cancelEventUid({ status: BookingStatus.HELD }, fresh())).toBeNull();
  });

  it('снимок HELD, но в свежей строке есть оплата → детерминированный uid', () => {
    expect(
      cancelEventUid(
        { status: BookingStatus.HELD },
        fresh({ paidAt: new Date() }),
      ),
    ).toBe(bookingEventUid(7));
  });

  it('снимок HELD, но подтверждение руками уже записало ссылку → детерминированный uid', () => {
    expect(
      cancelEventUid(
        { status: BookingStatus.HELD },
        fresh({ meetingUrl: 'enc:link' }),
      ),
    ).toBe(bookingEventUid(7));
  });
});

// Гонка «оплата пришла между чтением и отменой» (аудит 2026-10): cancel()
// прочитал HELD, вебхук выиграл CAS (CONFIRMED + paidAt), проход подтверждения
// записал ссылку, сделал PUT и умер до записи calDavUid. Строка — в памяти,
// CAS отмены работает по ней, снимок вызывающего остаётся HELD.
describe('claimCancel — признак подтверждения берётся из свежей строки', () => {
  function makePrisma(row: Booking) {
    const table = { row: { ...row } };
    const prisma = {
      booking: {
        updateMany: jest.fn(
          async ({
            where,
            data,
          }: {
            where: { status: { in: BookingStatus[] } };
            data: Partial<Booking>;
          }) => {
            if (!where.status.in.includes(table.row.status))
              return { count: 0 };
            Object.assign(table.row, data);
            return { count: 1 };
          },
        ),
        findUnique: jest.fn(async () => ({ ...table.row })),
      },
    } as never;
    return { prisma, table };
  }
  const base = {
    id: 9,
    cancelToken: 'tok-9',
    status: BookingStatus.HELD,
    calDavUid: null,
    paidAt: null,
    meetingUrl: null,
    heldUntil: new Date(),
  } as unknown as Booking;

  it('снимок HELD, а вебхук успел подтвердить и записать событие — отмена снимает его', async () => {
    const { prisma, table } = makePrisma({
      ...base,
      status: BookingStatus.CONFIRMED,
      paidAt: new Date(),
      meetingUrl: 'enc:link',
    });

    const res = await claimCancel(prisma, 'tok-9', { ...base });

    expect(table.row.status).toBe(BookingStatus.CANCELLED);
    expect(res?.eventUid).toBe(bookingEventUid(9));
  });

  it('контроль: оплаты не было, бронь осталась HELD — DELETE не нужен', async () => {
    const { prisma, table } = makePrisma({ ...base });

    const res = await claimCancel(prisma, 'tok-9', { ...base });

    expect(table.row.status).toBe(BookingStatus.CANCELLED);
    expect(res?.eventUid).toBeNull();
  });
});
