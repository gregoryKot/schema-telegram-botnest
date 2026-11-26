// Условие «оплатили сессию» для /stats (аудит 2026-10-11): оплата — это
// paidAt, бесплатное знакомство и ручное подтверждение в счёт не идут, а
// история до учёта paidAt (PAID_AT_TRACKED_SINCE) не обнуляется. Реальный
// запрос к Postgres — test/booking-paid-page.e2e-spec.ts.
import { BookingStatus, SessionType } from '@prisma/client';
import { PAID_AT_TRACKED_SINCE } from '../booking/booking-paid-at';
import {
  countPaidSessions,
  paidSessionsWhere,
} from './money-metrics.paid-sessions';

describe('paidSessionsWhere', () => {
  const SINCE = new Date('2026-11-01T00:00:00Z');

  it('за всё время: любая бронь с paidAt (в т.ч. CANCELLED — деньги после отмены)', () => {
    const [byPaidAt] = paidSessionsWhere().OR as object[];
    // Статус не фильтруется: деньги получены и после отмены брони.
    expect(byPaidAt).toEqual({ paidAt: { not: null } });
  });

  it('неделя: окно по дате оплаты, а не по дате создания брони', () => {
    const [byPaidAt] = paidSessionsWhere(SINCE).OR as object[];
    expect(byPaidAt).toEqual({ paidAt: { gte: SINCE } });
  });

  it('история до учёта: прежнее правило, но без знакомств и только до границы', () => {
    const [, legacy] = paidSessionsWhere().OR as Array<Record<string, unknown>>;
    expect(legacy).toEqual({
      paidAt: null,
      status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
      type: { not: SessionType.INTRO_15 },
      createdAt: { lt: PAID_AT_TRACKED_SINCE },
    });
  });

  it('история в недельном окне ограничена и снизу, и границей учёта', () => {
    const [, legacy] = paidSessionsWhere(SINCE).OR as Array<{
      createdAt: unknown;
    }>;
    expect(legacy.createdAt).toEqual({ gte: SINCE, lt: PAID_AT_TRACKED_SINCE });
  });

  it('countPaidSessions отдаёт число из prisma.booking.count с этим условием', async () => {
    const count = jest.fn().mockResolvedValue(4);
    const prisma = { booking: { count } } as never;

    await expect(countPaidSessions(prisma, SINCE)).resolves.toBe(4);
    expect(count).toHaveBeenCalledWith({ where: paidSessionsWhere(SINCE) });
  });
});
