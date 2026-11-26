// security#15 (аудит 2026-10-11): публичная проекция брони по токену отдаёт
// `paid` (из paidAt), чтобы страница возврата с оплаты различала «деньги есть,
// брони нет» и «открыли по токену без оплаты». Саму метку времени наружу не
// отдаём — только булев признак.
import { BookingStatus, SessionType } from '@prisma/client';
import { getPublicBookingByToken } from './booking.queries';

const row = (over: Record<string, unknown> = {}) => ({
  status: BookingStatus.HELD,
  type: SessionType.SESSION_50,
  startsAt: new Date('2026-07-13T10:00:00Z'),
  durationMin: 50,
  meetingUrl: null,
  paidAt: null,
  clientName: 'Секретное Имя',
  clientContact: '@secret',
  ...over,
});

const view = (bookingRow: Record<string, unknown>) =>
  getPublicBookingByToken(
    {
      booking: { findUnique: jest.fn(() => Promise.resolve(bookingRow)) },
    } as never,
    'tok',
  );

describe('getPublicBookingByToken — paid', () => {
  it('HELD без paidAt → paid=false (вебхук оплаты ещё не пришёл)', async () => {
    const res = await view(row());
    expect(res.status).toBe(BookingStatus.HELD);
    expect(res.paid).toBe(false);
  });

  it('CONFIRMED с paidAt → paid=true', async () => {
    const res = await view(
      row({ status: BookingStatus.CONFIRMED, paidAt: new Date() }),
    );
    expect(res.paid).toBe(true);
  });

  it('CANCELLED с paidAt («деньги есть, брони нет») → paid=true', async () => {
    const res = await view(
      row({ status: BookingStatus.CANCELLED, paidAt: new Date() }),
    );
    expect(res).toMatchObject({ status: BookingStatus.CANCELLED, paid: true });
  });

  it('подтверждённая админом бронь без paidAt → paid=false', async () => {
    const res = await view(row({ status: BookingStatus.CONFIRMED }));
    expect(res.paid).toBe(false);
  });

  // Ссылки на встречу тоже нет (аудит 2026-10): токен получает любой, кто
  // вызвал анонимную запись с чужим контактом.
  it('не отдаёт метку paidAt, PII и ссылку на встречу — только булев признак', async () => {
    const res = await view(
      row({
        paidAt: new Date('2026-07-13T09:00:00Z'),
        meetingUrl: 'https://zoom.example/j/1?pwd=secret',
      }),
    );
    expect(Object.keys(res).sort()).toEqual([
      'durationMin',
      'endsAt',
      'paid',
      'startsAt',
      'status',
      'type',
    ]);
  });
});
