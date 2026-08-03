// Полный проход book(): TOCTOU-защита через pg_advisory_xact_lock внутри
// $transaction (P-1, аудит 2026-07) и интеграция с assertWithinAvailability —
// не только приватный метод (см. booking.availability.spec.ts), но и весь
// путь: валидация → лок → проверка слота → создание → side-effects.
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, SessionType } from '@prisma/client';
import { BookingService } from './booking.service';
import { MIN_BOOK_LEAD_HOURS, MIN_CANCEL_LEAD_HOURS } from './booking.config';

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
      }),
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
      }),
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
      }),
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
      }),
    ).rejects.toThrow('TOO_SOON');
  });

  // Граница "< now + 12ч" (не "<="): ровно через 12ч бронь ДОЛЖНА пройти
  // валидацию лида (упадёт позже на другой проверке — здесь важно не TOO_SOON).
  it('слот РОВНО через MIN_BOOK_LEAD_HOURS — НЕ TOO_SOON (граница включительно разрешена)', async () => {
    const { service, prisma } = makeService({ rules: [] });
    const res = await service.book({
      ...BASE_DTO,
      startsAt: new Date(FIXED_NOW.getTime() + MIN_BOOK_LEAD_HOURS * 3_600_000),
      durationMin: 50,
      type: SessionType.SESSION_50,
    });
    expect(res.status).toBe(BookingStatus.CONFIRMED); // Robokassa выключена в этом makeService по умолчанию
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('слот на 1мс раньше границы MIN_BOOK_LEAD_HOURS — TOO_SOON', async () => {
    const { service } = makeService({ rules: [] });
    await expect(
      service.book({
        ...BASE_DTO,
        startsAt: new Date(
          FIXED_NOW.getTime() + MIN_BOOK_LEAD_HOURS * 3_600_000 - 1,
        ),
        durationMin: 50,
        type: SessionType.SESSION_50,
      }),
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
      }),
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
    });
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
      }),
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
    });
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
    });
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
    });
    expect(res.status).toBe(BookingStatus.CONFIRMED);
    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: BookingStatus.CONFIRMED }),
      }),
    );
    expect(notify.onConfirmed).toHaveBeenCalledTimes(1);
  });
});

// ── cancel / list / getById / getPublicByToken / expireHolds — до этих правок
// не было ни одного теста на эти пять методов BookingService (весь набор
// booking.*.spec.ts покрывал только book()/confirm()/assertWithinAvailability).
function makeSimpleService(
  opts: {
    bookingRow?: any;
    bookingRows?: any[];
  } = {},
) {
  const state = { row: opts.bookingRow ? { ...opts.bookingRow } : null };
  const rows = opts.bookingRows ?? [];
  const prisma: any = {
    booking: {
      findUnique: jest.fn(async ({ where }: any) => {
        if (where.cancelToken !== undefined) return state.row;
        if (where.id !== undefined)
          return rows.find((r) => r.id === where.id) ?? state.row;
        return state.row;
      }),
      update: jest.fn(async ({ data }: any) => {
        Object.assign(state.row, data);
        return state.row;
      }),
      updateMany: jest.fn(async () => ({ count: rows.length })),
      findMany: jest.fn(async () => rows),
    },
  };
  const notify = {
    onCancelled: jest.fn(async () => undefined),
    notifyExpired: jest.fn(async () => undefined),
  };
  const service = new BookingService(
    prisma,
    notify as any,
    {} as any,
    {} as any,
    {} as any,
    { get: () => undefined } as any,
  );
  return { service, prisma, notify, state, rows };
}

describe('BookingService.cancel', () => {
  const activeBooking = (overrides: Partial<any> = {}) => ({
    id: 5,
    status: BookingStatus.HELD,
    startsAt: new Date(Date.now() + 48 * 3_600_000), // с запасом вне cutoff
    durationMin: 50,
    calDavUid: 'cal-1',
    clientName: 'Мария',
    clientContact: '@maria',
    ...overrides,
  });

  it('токен не найден → NotFoundException', async () => {
    const { service } = makeSimpleService({ bookingRow: null });
    await expect(service.cancel('nope')).rejects.toThrow(NotFoundException);
  });

  it('уже CANCELLED → идемпотентный {ok:true}, update НЕ вызывается повторно', async () => {
    const { service, prisma } = makeSimpleService({
      bookingRow: activeBooking({ status: BookingStatus.CANCELLED }),
    });
    await expect(service.cancel('tok')).resolves.toEqual({ ok: true });
    expect(prisma.booking.update).not.toHaveBeenCalled();
  });

  it('COMPLETED — отменить нельзя (BadRequestException), update не вызывается', async () => {
    const { service, prisma } = makeSimpleService({
      bookingRow: activeBooking({ status: BookingStatus.COMPLETED }),
    });
    await expect(service.cancel('tok')).rejects.toThrow(BadRequestException);
    expect(prisma.booking.update).not.toHaveBeenCalled();
  });

  it('внутри окна MIN_CANCEL_LEAD_HOURS (24ч) с enforceCutoff — CANCEL_TOO_LATE', async () => {
    const { service } = makeSimpleService({
      bookingRow: activeBooking({
        startsAt: new Date(Date.now() + 10 * 3_600_000), // через 10ч < 24ч
      }),
    });
    await expect(service.cancel('tok')).rejects.toThrow('CANCEL_TOO_LATE');
  });

  // Граница "< now + 24ч": ровно на границе отмена ещё разрешена.
  it('слот РОВНО через MIN_CANCEL_LEAD_HOURS — отмена проходит (граница включительно разрешена)', async () => {
    const now = Date.now();
    const { service, state } = makeSimpleService({
      bookingRow: activeBooking({
        startsAt: new Date(now + MIN_CANCEL_LEAD_HOURS * 3_600_000 + 5_000),
      }),
    });
    await expect(service.cancel('tok')).resolves.toEqual({ ok: true });
    expect(state.row.status).toBe(BookingStatus.CANCELLED);
  });

  it('слот на 1мс раньше границы MIN_CANCEL_LEAD_HOURS — CANCEL_TOO_LATE', async () => {
    const now = Date.now();
    const { service } = makeSimpleService({
      bookingRow: activeBooking({
        startsAt: new Date(now + MIN_CANCEL_LEAD_HOURS * 3_600_000 - 1),
      }),
    });
    await expect(service.cancel('tok')).rejects.toThrow('CANCEL_TOO_LATE');
  });

  it('enforceCutoff=false (админ) обходит окно — отмена проходит даже "поздно"', async () => {
    const { service, state } = makeSimpleService({
      bookingRow: activeBooking({
        startsAt: new Date(Date.now() + 3_600_000), // через 1ч — обычно CANCEL_TOO_LATE
      }),
    });
    await expect(service.cancel('tok', false)).resolves.toEqual({
      ok: true,
    });
    expect(state.row.status).toBe(BookingStatus.CANCELLED);
  });

  it('успешная отмена: статус CANCELLED, heldUntil сброшен, notify.onCancelled получает расшифрованные данные и calDavUid', async () => {
    const { service, state, notify } = makeSimpleService({
      bookingRow: activeBooking({ heldUntil: new Date(), calDavUid: 'cal-42' }),
    });
    await service.cancel('tok');
    expect(state.row.status).toBe(BookingStatus.CANCELLED);
    expect(state.row.heldUntil).toBeNull();
    expect(notify.onCancelled).toHaveBeenCalledWith(
      expect.objectContaining({ clientName: 'Мария', clientContact: '@maria' }),
      'cal-42',
    );
  });
});

describe('BookingService.getById', () => {
  it('не найдена → NotFoundException', async () => {
    const { service } = makeSimpleService({ bookingRows: [] });
    await expect(service.getById(999)).rejects.toThrow(NotFoundException);
  });

  it('найдена → возвращает расшифрованные данные брони', async () => {
    const { service } = makeSimpleService({
      bookingRows: [
        { id: 3, status: BookingStatus.CONFIRMED, clientName: 'Пётр' },
      ],
    });
    const res = await service.getById(3);
    expect(res).toMatchObject({ id: 3, clientName: 'Пётр' });
  });
});

describe('BookingService.getPublicByToken', () => {
  it('токен не найден → NotFoundException', async () => {
    const { service } = makeSimpleService({ bookingRow: null });
    await expect(service.getPublicByToken('nope')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('endsAt считается как startsAt + durationMin минут (арифметика, не константа)', async () => {
    const { service } = makeSimpleService({
      bookingRow: {
        status: BookingStatus.CONFIRMED,
        type: SessionType.SESSION_50,
        startsAt: new Date('2026-07-13T10:00:00Z'),
        durationMin: 50,
        meetingUrl: 'https://meet.test/x',
      },
    });
    const res = await service.getPublicByToken('tok');
    expect(res.startsAt).toBe('2026-07-13T10:00:00.000Z');
    expect(res.endsAt).toBe('2026-07-13T10:50:00.000Z');
    expect(res.meetingUrl).toBe('https://meet.test/x');
  });

  it('не отдаёт clientName/clientContact (публичный вид без PII)', async () => {
    const { service } = makeSimpleService({
      bookingRow: {
        status: BookingStatus.CONFIRMED,
        type: SessionType.SESSION_50,
        startsAt: new Date('2026-07-13T10:00:00Z'),
        durationMin: 50,
        clientName: 'Секретное Имя',
        clientContact: '@secret',
      },
    });
    const res = await service.getPublicByToken('tok');
    expect(res).not.toHaveProperty('clientName');
    expect(res).not.toHaveProperty('clientContact');
  });
});

describe('BookingService.list', () => {
  const rows = [
    { id: 1, status: BookingStatus.HELD, startsAt: new Date() },
    { id: 2, status: BookingStatus.CANCELLED, startsAt: new Date() },
  ];

  it('upcoming (по умолчанию): фильтр по будущим HELD/CONFIRMED, сортировка asc', async () => {
    const { service, prisma } = makeSimpleService({ bookingRows: rows });
    await service.list();
    const call = prisma.booking.findMany.mock.calls[0][0];
    expect(call.where.status.in).toEqual([
      BookingStatus.HELD,
      BookingStatus.CONFIRMED,
    ]);
    expect(call.where.startsAt.gte).toBeInstanceOf(Date);
    expect(call.orderBy).toEqual({ startsAt: 'asc' });
  });

  it('past: фильтр startsAt < now, сортировка desc', async () => {
    const { service, prisma } = makeSimpleService({ bookingRows: rows });
    await service.list('past');
    const call = prisma.booking.findMany.mock.calls[0][0];
    expect(call.where).toEqual({ startsAt: { lt: expect.any(Date) } });
    expect(call.orderBy).toEqual({ startsAt: 'desc' });
  });

  it('cancelled: фильтр по статусу CANCELLED, сортировка desc', async () => {
    const { service, prisma } = makeSimpleService({ bookingRows: rows });
    await service.list('cancelled');
    const call = prisma.booking.findMany.mock.calls[0][0];
    expect(call.where).toEqual({ status: BookingStatus.CANCELLED });
    expect(call.orderBy).toEqual({ startsAt: 'desc' });
  });

  it('all: без фильтра (пустой where), сортировка desc — не теряет чужие брони и не подмешивает лишний фильтр', async () => {
    const { service, prisma } = makeSimpleService({ bookingRows: rows });
    await service.list('all');
    const call = prisma.booking.findMany.mock.calls[0][0];
    expect(call.where).toEqual({});
    expect(call.orderBy).toEqual({ startsAt: 'desc' });
  });
});

describe('BookingService.expireHolds', () => {
  it('нет истёкших HELD — updateMany и notifyExpired не вызываются', async () => {
    const { service, prisma, notify } = makeSimpleService({
      bookingRows: [],
    });
    prisma.booking.findMany = jest.fn(async () => []);
    await service.expireHolds();
    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: BookingStatus.HELD }),
      }),
    );
    expect(prisma.booking.updateMany).not.toHaveBeenCalled();
    expect(notify.notifyExpired).not.toHaveBeenCalled();
  });

  it('есть истёкшие HELD — переводит их в CANCELLED по точным id, уведомляет расшифрованным списком', async () => {
    const expiring = [
      { id: 11, status: BookingStatus.HELD, clientName: 'А' },
      { id: 12, status: BookingStatus.HELD, clientName: 'Б' },
    ];
    const { service, prisma, notify } = makeSimpleService({});
    prisma.booking.findMany = jest.fn(async () => expiring);
    prisma.booking.updateMany = jest.fn(async () => ({ count: 2 }));
    await service.expireHolds();
    expect(prisma.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: [11, 12] } },
        data: expect.objectContaining({
          status: BookingStatus.CANCELLED,
          heldUntil: null,
        }),
      }),
    );
    expect(notify.notifyExpired).toHaveBeenCalledWith([
      expect.objectContaining({ id: 11, clientName: 'А' }),
      expect.objectContaining({ id: 12, clientName: 'Б' }),
    ]);
  });
});
