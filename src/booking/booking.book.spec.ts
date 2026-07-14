// Полный проход book(): TOCTOU-защита через pg_advisory_xact_lock внутри
// $transaction (P-1, аудит 2026-07) и интеграция с assertWithinAvailability —
// не только приватный метод (см. booking.availability.spec.ts), но и весь
// путь: валидация → лок → проверка слота → создание → side-effects.
import { BadRequestException, ConflictException } from '@nestjs/common';
import { BookingStatus, SessionType } from '@prisma/client';
import { BookingService } from './booking.service';

const FIXED_NOW = new Date('2026-07-13T00:00:00Z'); // понедельник, 00:00 UTC
const RULE = {
  id: 1,
  dayOfWeek: 1, // Mon
  startHour: 10,
  startMinute: 0,
  endHour: 19,
  endMinute: 0,
  timezone: 'Europe/Moscow',
  isActive: true,
};
const INSIDE_WINDOW = new Date(FIXED_NOW.getTime() + 13 * 3_600_000); // пн 16:00 МСК

function makeService(
  opts: {
    rules?: any[];
    existingBookings?: any[];
    robokassaEnabled?: boolean;
  } = {},
) {
  const bookingRows: any[] = opts.existingBookings
    ? [...opts.existingBookings]
    : [];
  let nextId = 100;
  const tx = {
    $queryRaw: jest.fn(async () => undefined),
    booking: {
      findMany: jest.fn(async ({ where }: any) => {
        const endsAt: Date = where.startsAt.lt;
        const statuses: string[] = where.status.in;
        return bookingRows.filter(
          (b) => statuses.includes(b.status) && b.startsAt < endsAt,
        );
      }),
      create: jest.fn(async ({ data }: any) => {
        const row = { id: nextId++, ...data };
        bookingRows.push(row);
        return row;
      }),
    },
  };
  const prisma: any = {
    availabilityRule: { findMany: jest.fn(async () => opts.rules ?? []) },
    $transaction: jest.fn(async (fn: any) => fn(tx)),
    booking: {
      update: jest.fn(async ({ where, data }: any) => {
        const row = bookingRows.find((b) => b.id === where.id);
        Object.assign(row, data);
        return row;
      }),
    },
  };
  const notify = {
    onConfirmed: jest.fn(async () => undefined),
    onAwaitingPayment: jest.fn(async () => undefined),
    alertAdmin: jest.fn(async () => undefined),
  };
  const meeting = { hasMeetingForContact: jest.fn(async () => true) };
  const robokassa = {
    enabled: opts.robokassaEnabled ?? false,
    buildPaymentUrl: jest.fn(() => 'https://auth.robokassa.ru/pay?x=1'),
  };
  const pricing = { getPrice: jest.fn(async () => 4000) };
  const config = { get: () => undefined };
  const service = new BookingService(
    prisma,
    notify as any,
    meeting as any,
    robokassa as any,
    pricing as any,
    config as any,
  );
  return {
    service,
    prisma,
    tx,
    notify,
    meeting,
    robokassa,
    pricing,
  };
}

const BASE_DTO = {
  clientName: 'Мария',
  clientContact: '@maria',
  acceptedOffer: true,
};

describe('BookingService.book — валидация до транзакции', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_NOW);
  });
  afterEach(() => jest.useRealTimers());

  it('без имени/контакта — BadRequestException', async () => {
    const { service } = makeService();
    await expect(
      service.book({
        ...BASE_DTO,
        clientName: '',
        startsAt: INSIDE_WINDOW,
        durationMin: 50,
        type: SessionType.SESSION_50,
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('без оферты — OFFER_NOT_ACCEPTED', async () => {
    const { service } = makeService();
    await expect(
      service.book({
        ...BASE_DTO,
        acceptedOffer: false,
        startsAt: INSIDE_WINDOW,
        durationMin: 50,
        type: SessionType.SESSION_50,
      } as any),
    ).rejects.toThrow('OFFER_NOT_ACCEPTED');
  });

  it('returning=true без личной встречи — CLIENT_NOT_FOUND', async () => {
    const { service, meeting } = makeService();
    meeting.hasMeetingForContact.mockResolvedValue(false);
    await expect(
      service.book({
        ...BASE_DTO,
        returning: true,
        startsAt: INSIDE_WINDOW,
        durationMin: 50,
        type: SessionType.SESSION_50,
      } as any),
    ).rejects.toThrow('CLIENT_NOT_FOUND');
  });

  it('слот раньше MIN_BOOK_LEAD_HOURS (12ч) — TOO_SOON', async () => {
    const { service } = makeService();
    await expect(
      service.book({
        ...BASE_DTO,
        startsAt: new Date(FIXED_NOW.getTime() + 3_600_000), // через 1 час
        durationMin: 50,
        type: SessionType.SESSION_50,
      } as any),
    ).rejects.toThrow('TOO_SOON');
  });

  it('вне окна доступности (интеграционно, не только приватный метод) — OUTSIDE_AVAILABILITY, до лока и записи', async () => {
    const { service, prisma } = makeService({ rules: [RULE] });
    await expect(
      service.book({
        ...BASE_DTO,
        startsAt: new Date(FIXED_NOW.getTime() + 20 * 3_600_000), // пн 23:00 МСК
        durationMin: 50,
        type: SessionType.SESSION_50,
      } as any),
    ).rejects.toThrow('OUTSIDE_AVAILABILITY');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('BookingService.book — advisory-lock и TOCTOU (P-1)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_NOW);
  });
  afterEach(() => jest.useRealTimers());

  it('слот свободен: лок берётся, бронь создаётся внутри транзакции', async () => {
    const { service, tx } = makeService({ rules: [] });
    await service.book({
      ...BASE_DTO,
      startsAt: INSIDE_WINDOW,
      durationMin: 50,
      type: SessionType.SESSION_50,
    } as any);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1); // advisory lock взят
    expect(tx.booking.create).toHaveBeenCalledTimes(1);
  });

  it('слот уже занят другой HELD/CONFIRMED бронью — ConflictException, вторая бронь не создаётся', async () => {
    const { service, tx } = makeService({
      rules: [],
      existingBookings: [
        {
          id: 1,
          startsAt: INSIDE_WINDOW,
          durationMin: 50,
          status: BookingStatus.CONFIRMED,
        },
      ],
    });
    await expect(
      service.book({
        ...BASE_DTO,
        startsAt: INSIDE_WINDOW,
        durationMin: 50,
        type: SessionType.SESSION_50,
      } as any),
    ).rejects.toThrow(ConflictException);
    expect(tx.booking.create).not.toHaveBeenCalled();
  });
});

describe('BookingService.book — создание и side-effects', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_NOW);
  });
  afterEach(() => jest.useRealTimers());

  it('INTRO_15 (бесплатно) — сразу CONFIRMED, notify.onConfirmed вызван, Robokassa не трогается', async () => {
    const { service, notify, robokassa } = makeService({ rules: [] });
    const res = await service.book({
      ...BASE_DTO,
      startsAt: INSIDE_WINDOW,
      durationMin: 15,
      type: SessionType.INTRO_15,
    } as any);
    expect(res.status).toBe(BookingStatus.CONFIRMED);
    expect(notify.onConfirmed).toHaveBeenCalledTimes(1);
    expect(robokassa.buildPaymentUrl).not.toHaveBeenCalled();
  });

  it('SESSION_50 + Robokassa включена — остаётся HELD, возвращает paymentUrl, admin уведомлён об ожидании оплаты', async () => {
    const { service, notify, robokassa, pricing } = makeService({
      rules: [],
      robokassaEnabled: true,
    });
    const res = await service.book({
      ...BASE_DTO,
      startsAt: INSIDE_WINDOW,
      durationMin: 50,
      type: SessionType.SESSION_50,
    } as any);
    expect(res.status).toBe(BookingStatus.HELD);
    expect(res.paymentUrl).toBeTruthy();
    expect(pricing.getPrice).toHaveBeenCalledWith(SessionType.SESSION_50);
    expect(robokassa.buildPaymentUrl).toHaveBeenCalledTimes(1);
    expect(notify.onAwaitingPayment).toHaveBeenCalledTimes(1);
    expect(notify.onConfirmed).not.toHaveBeenCalled();
  });

  it('SESSION_50 + Robokassa выключена (dev) — авто-подтверждение, notify.onConfirmed вызван', async () => {
    const { service, notify, prisma } = makeService({
      rules: [],
      robokassaEnabled: false,
    });
    const res = await service.book({
      ...BASE_DTO,
      startsAt: INSIDE_WINDOW,
      durationMin: 50,
      type: SessionType.SESSION_50,
    } as any);
    expect(res.status).toBe(BookingStatus.CONFIRMED);
    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: BookingStatus.CONFIRMED }),
      }),
    );
    expect(notify.onConfirmed).toHaveBeenCalledTimes(1);
  });
});
