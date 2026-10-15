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
import { LEASE_WINDOW } from '../infra/cron-leader.service';
import { RETURNING_NOT_FOUND_NOTE } from './booking-admin-note';

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
    $executeRaw: jest.fn(async () => undefined),
    booking: {
      findMany: jest.fn(async ({ where }: any) => {
        const endsAt: Date = where.startsAt.lt;
        // D4: скан ограничен снизу (startsAt.gte) — фейк уважает границу, иначе
        // тест не отличил бы ограниченный скан от неограниченного.
        const from: Date | undefined = where.startsAt.gte;
        const statuses: string[] = where.status.in;
        return bookingRows.filter(
          (b) =>
            statuses.includes(b.status) &&
            b.startsAt < endsAt &&
            (!from || b.startsAt >= from),
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
    slotOverride: { findMany: jest.fn(async () => []) },
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
  const cronLeader = {
    claimRun: jest.fn().mockResolvedValue(true),
  } as any;
  const service = new BookingService(
    prisma,
    notify as any,
    meeting as any,
    robokassa as any,
    pricing as any,
    config as any,
    cronLeader,
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

  // security#19 (аудит 2026-10): ответ не должен выдавать, клиент ли этот контакт.
  const RETURNING_DTO = {
    ...BASE_DTO,
    returning: true,
    startsAt: INSIDE_WINDOW,
    durationMin: 50,
    type: SessionType.SESSION_50,
  };

  it('returning=true без личной встречи — бронь создаётся как первая, ответ тот же, что у найденного контакта; админу уходит пометка', async () => {
    const stranger = makeService({ robokassaEnabled: true });
    stranger.meeting.hasMeetingForContact.mockResolvedValue(false);
    const known = makeService({ robokassaEnabled: true });
    known.meeting.hasMeetingForContact.mockResolvedValue(true);

    const rStranger = await stranger.service.book(RETURNING_DTO);
    const rKnown = await known.service.book(RETURNING_DTO);

    expect(rStranger.status).toBe(rKnown.status);
    expect(Object.keys(rStranger).sort()).toEqual(Object.keys(rKnown).sort());
    // Цена — первой встречи: тип брони тот же, что у обычной записи на сессию.
    expect(stranger.pricing.getPrice).toHaveBeenCalledWith(
      SessionType.SESSION_50,
    );
    expect(stranger.notify.onAwaitingPayment).toHaveBeenCalledWith(
      expect.objectContaining({ clientContact: BASE_DTO.clientContact }),
      RETURNING_NOT_FOUND_NOTE,
    );
    expect(known.notify.onAwaitingPayment).toHaveBeenCalledWith(
      expect.objectContaining({ clientContact: BASE_DTO.clientContact }),
      undefined,
    );
  });

  it('INTRO_15 с returning=true (старый клиент) — returning игнорируется, бронь создаётся без проверки личной встречи', async () => {
    const { service, meeting } = makeService();
    meeting.hasMeetingForContact.mockResolvedValue(false);
    const res = await service.book({
      ...BASE_DTO,
      returning: true,
      startsAt: INSIDE_WINDOW,
      durationMin: 15,
      type: SessionType.INTRO_15,
    });
    expect(res.status).toBe(BookingStatus.CONFIRMED);
    expect(meeting.hasMeetingForContact).not.toHaveBeenCalled();
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
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1); // advisory lock взят
    // Именно тот advisory-lock ключ, что защищает слот бронирований (не случайный).
    const lockCall = (tx.$executeRaw as jest.Mock).mock.calls[0];
    expect(lockCall[0].join('?')).toContain('pg_advisory_xact_lock');

    expect(tx.booking.create).toHaveBeenCalledTimes(1);
    const created = (tx.booking.create as jest.Mock).mock.calls[0][0].data;
    expect(created.startsAt).toEqual(INSIDE_WINDOW);
    expect(created.durationMin).toBe(50);
    expect(created.type).toBe(SessionType.SESSION_50);
    // Платная сессия заходит в БД со статусом HELD — CONFIRMED выставляется
    // отдельным update() уже после транзакции (auto-confirm без Robokassa).
    expect(created.status).toBe(BookingStatus.HELD);
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
    claimRun?: boolean;
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
      // CAS как в Postgres: WHERE на токен и СТАТУС (значение или {in}) решает,
      // обновится ли строка; count — сколько реально обновлено.
      updateMany: jest.fn(async ({ where, data }: any) => {
        const row = state.row;
        const statuses = where.status?.in ?? [where.status];
        if (
          !row ||
          (where.status !== undefined && !statuses.includes(row.status))
        )
          return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      }),
      findMany: jest.fn(async () => rows),
    },
  };
  const notify = {
    onCancelled: jest.fn(async () => undefined),
    notifyExpired: jest.fn(async () => undefined),
  };
  const claimRun = jest.fn().mockResolvedValue(opts.claimRun ?? true);
  const cronLeader = { claimRun } as any;
  const service = new BookingService(
    prisma,
    notify as any,
    {} as any,
    {} as any,
    {} as any,
    { get: () => undefined } as any,
    cronLeader,
  );
  return { service, prisma, notify, state, rows, claimRun };
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

  // Аудит 2026-10-11, r2-1#1: find→update без предиката статуса — N параллельных
  // отмен давали N× DM+письмо+DELETE, а отмена поверх подтверждения брала
  // calDavUid из снимка до CAS (null) и не снимала событие из календаря.
  it('CAS отмены: updateMany по токену с предикатом status in [HELD, CONFIRMED]', async () => {
    const { service, prisma } = makeSimpleService({
      bookingRow: activeBooking(),
    });
    await service.cancel('tok');
    expect(prisma.booking.updateMany).toHaveBeenCalledWith({
      where: {
        cancelToken: 'tok',
        status: { in: [BookingStatus.HELD, BookingStatus.CONFIRMED] },
      },
      data: { status: BookingStatus.CANCELLED, heldUntil: null },
    });
    expect(prisma.booking.update).not.toHaveBeenCalled();
  });

  it('проиграл CAS (параллельная отмена уже перевела в CANCELLED) → {ok:true} БЕЗ onCancelled', async () => {
    const { service, prisma, notify } = makeSimpleService({
      bookingRow: activeBooking(),
    });
    // Снимок до CAS ещё HELD, а к моменту updateMany строку забрал соседний вызов.
    prisma.booking.updateMany = jest.fn(async () => ({ count: 0 }));
    const orig = prisma.booking.findUnique.getMockImplementation();
    let reads = 0;
    prisma.booking.findUnique = jest.fn(async (args: any) => {
      const row = await orig!(args);
      return ++reads === 1 ? row : { ...row, status: BookingStatus.CANCELLED };
    });
    await expect(service.cancel('tok')).resolves.toEqual({ ok: true });
    expect(notify.onCancelled).not.toHaveBeenCalled();
  });

  it('проиграл CAS, а в базе уже COMPLETED → BadRequest, а не молчаливый ok', async () => {
    const { service, prisma, notify } = makeSimpleService({
      bookingRow: activeBooking(),
    });
    prisma.booking.updateMany = jest.fn(async () => ({ count: 0 }));
    const orig = prisma.booking.findUnique.getMockImplementation();
    let reads = 0;
    prisma.booking.findUnique = jest.fn(async (args: any) => {
      const row = await orig!(args);
      return ++reads === 1 ? row : { ...row, status: BookingStatus.COMPLETED };
    });
    await expect(service.cancel('tok')).rejects.toThrow(BadRequestException);
    expect(notify.onCancelled).not.toHaveBeenCalled();
  });

  it('onCancelled получает calDavUid СВЕЖЕЙ строки (выигравший confirm успел записать событие), а не снимка до CAS', async () => {
    const { service, prisma, notify } = makeSimpleService({
      bookingRow: activeBooking({ calDavUid: null }),
    });
    const orig = prisma.booking.findUnique.getMockImplementation();
    let reads = 0;
    prisma.booking.findUnique = jest.fn(async (args: any) => {
      const row = await orig!(args);
      // первое чтение (проверки) — calDavUid ещё нет; после CAS — confirm дописал
      return ++reads === 1 ? row : { ...row, calDavUid: 'booking-5@cal' };
    });
    await service.cancel('tok');
    expect(notify.onCancelled).toHaveBeenCalledWith(
      expect.anything(),
      'booking-5@cal',
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

  // Аудит 2026-10-11, r2-1#0: updateMany по `id in (…)` без статуса перекрашивал
  // в CANCELLED бронь, подтверждённую вебхуком между findMany и updateMany.
  it('есть истёкшие HELD — CAS на каждую строку (id + status HELD + heldUntil), уведомляет расшифрованным списком', async () => {
    const expiring = [
      { id: 11, status: BookingStatus.HELD, clientName: 'А' },
      { id: 12, status: BookingStatus.HELD, clientName: 'Б' },
    ];
    const { service, prisma, notify } = makeSimpleService({});
    prisma.booking.findMany = jest.fn(async () => expiring);
    prisma.booking.updateMany = jest.fn(async () => ({ count: 1 }));
    await service.expireHolds();
    for (const id of [11, 12]) {
      expect(prisma.booking.updateMany).toHaveBeenCalledWith({
        where: {
          id,
          status: BookingStatus.HELD,
          heldUntil: { lte: expect.any(Date) },
        },
        data: { status: BookingStatus.CANCELLED, heldUntil: null },
      });
    }
    expect(prisma.booking.updateMany).toHaveBeenCalledTimes(2);
    expect(notify.notifyExpired).toHaveBeenCalledWith([
      expect.objectContaining({ id: 11, clientName: 'А' }),
      expect.objectContaining({ id: 12, clientName: 'Б' }),
    ]);
  });

  it('строку уже перевёл вебхук (CAS count=0) — «истекла без оплаты» по ней НЕ уходит, остальные уходят', async () => {
    const expiring = [
      { id: 11, status: BookingStatus.HELD, clientName: 'А' },
      { id: 12, status: BookingStatus.HELD, clientName: 'Б' },
    ];
    const { service, prisma, notify } = makeSimpleService({});
    prisma.booking.findMany = jest.fn(async () => expiring);
    prisma.booking.updateMany = jest.fn(async ({ where }: any) => ({
      count: where.id === 11 ? 0 : 1, // 11 успел подтвердиться
    }));
    await service.expireHolds();
    expect(notify.notifyExpired).toHaveBeenCalledWith([
      expect.objectContaining({ id: 12 }),
    ]);
  });

  it('все строки снимка уже переведены другими — notifyExpired не вызывается', async () => {
    const { service, prisma, notify } = makeSimpleService({});
    prisma.booking.findMany = jest.fn(async () => [
      { id: 11, status: BookingStatus.HELD },
    ]);
    prisma.booking.updateMany = jest.fn(async () => ({ count: 0 }));
    await service.expireHolds();
    // CAS всё равно попробован — по этой строке, с предикатом статуса.
    expect(prisma.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 11, status: BookingStatus.HELD }),
      }),
    );
    expect(notify.notifyExpired).not.toHaveBeenCalled();
  });

  it('тик уже забрал другой инстанс — findMany не вызывается, брони не трогаем', async () => {
    const { service, prisma, notify, claimRun } = makeSimpleService({
      claimRun: false,
    });
    await service.expireHolds();
    expect(claimRun).toHaveBeenCalledWith(
      'bookingExpireHolds',
      LEASE_WINDOW.everyMinute,
    );
    expect(prisma.booking.findMany).not.toHaveBeenCalled();
    expect(notify.notifyExpired).not.toHaveBeenCalled();
  });
});
