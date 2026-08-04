// Точечное усиление против выживших мутантов в booking.service.ts:
// денормализованные ?? null поля, heldUntil-арифметика, returning-check,
// граница assertSlotFree (cEnd>startsAt), optional chaining в confirm().
import { BookingStatus, SessionType } from '@prisma/client';
import { BookingService } from './booking.service';

// HOLD_MINUTES — приватная константа booking.service.ts (=15), не экспортируется.
// Дублируем значение здесь намеренно: тест ловит именно арифметику
// (Date.now() + HOLD_MINUTES*60_000), а не саму константу.
const HOLD_MINUTES_FOR_TEST = 15;

const FIXED_NOW = new Date('2026-07-13T00:00:00Z');
const INSIDE_WINDOW = new Date(FIXED_NOW.getTime() + 13 * 3_600_000);

function makeService(
  opts: { existingBookings?: any[]; robokassaEnabled?: boolean } = {},
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
    availabilityRule: { findMany: jest.fn(async () => []) },
    $transaction: jest.fn(async (fn: any) => fn(tx)),
    booking: { update: jest.fn(async () => ({})) },
  };
  const notify = {
    onConfirmed: jest.fn(async () => undefined),
    onAwaitingPayment: jest.fn(async () => undefined),
  };
  const meeting = { hasMeetingForContact: jest.fn(async () => false) };
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
  return { service, prisma, tx, notify, meeting };
}

const BASE_DTO = {
  clientName: 'Мария',
  clientContact: '@maria',
  acceptedOffer: true,
};

describe('BookingService.book — returning-check не блокирует НЕ-возвращающихся клиентов', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_NOW);
  });
  afterEach(() => jest.useRealTimers());

  // LogicalOperator: dto.returning && !hasMeeting → dto.returning || !hasMeeting
  // сломал бы ЭТОТ сценарий (returning не установлен, hasMeeting=false из мока) —
  // мутант кинул бы CLIENT_NOT_FOUND, хотя проверка вообще не должна выполняться.
  it('returning не передан, hasMeetingForContact=false → бронь ВСЁ РАВНО создаётся (проверка returning пропущена)', async () => {
    const { service, meeting } = makeService();
    const res = await service.book({
      ...BASE_DTO,
      startsAt: INSIDE_WINDOW,
      durationMin: 15,
      type: SessionType.INTRO_15,
    });
    expect(res.status).toBe(BookingStatus.CONFIRMED);
    expect(meeting.hasMeetingForContact).not.toHaveBeenCalled();
  });
});

describe('BookingService.book — heldUntil считается арифметически, не хардкодится', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_NOW);
  });
  afterEach(() => jest.useRealTimers());

  it('heldUntil = now + HOLD_MINUTES (не now - X и не деление)', async () => {
    const { service } = makeService({ robokassaEnabled: true });
    const res = await service.book({
      ...BASE_DTO,
      startsAt: INSIDE_WINDOW,
      durationMin: 50,
      type: SessionType.SESSION_50,
    });
    expect(res.heldUntil).not.toBeNull();
    const diffMin = (res.heldUntil!.getTime() - FIXED_NOW.getTime()) / 60_000;
    expect(diffMin).toBe(HOLD_MINUTES_FOR_TEST);
  });
});

describe('BookingService.book — денормализованные ?? null поля сохраняются как переданы', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_NOW);
  });
  afterEach(() => jest.useRealTimers());

  it('message передан → сохраняется как есть (не null из-за ?? → && мутации)', async () => {
    const { service, tx } = makeService();
    await service.book({
      ...BASE_DTO,
      message: 'Хочу обсудить тревогу',
      startsAt: INSIDE_WINDOW,
      durationMin: 15,
      type: SessionType.INTRO_15,
    });
    const created = tx.booking.create.mock.calls[0][0].data;
    expect(created.message).toBe('Хочу обсудить тревогу');
  });

  it('message не передан → сохраняется null (не undefined, не строка)', async () => {
    const { service, tx } = makeService();
    await service.book({
      ...BASE_DTO,
      startsAt: INSIDE_WINDOW,
      durationMin: 15,
      type: SessionType.INTRO_15,
    });
    const created = tx.booking.create.mock.calls[0][0].data;
    expect(created.message).toBeNull();
  });

  it('clientTelegramId передан → сохраняется как есть, не обнуляется', async () => {
    const { service, tx } = makeService();
    await service.book({
      ...BASE_DTO,
      clientTelegramId: 999n,
      startsAt: INSIDE_WINDOW,
      durationMin: 15,
      type: SessionType.INTRO_15,
    });
    const created = tx.booking.create.mock.calls[0][0].data;
    expect(created.clientTelegramId).toBe(999n);
  });

  it('source длиннее 200 символов обрезается до 200 (MethodExpression .slice)', async () => {
    const { service, tx } = makeService();
    const longSource = 'x'.repeat(500);
    await service.book({
      ...BASE_DTO,
      source: longSource,
      startsAt: INSIDE_WINDOW,
      durationMin: 15,
      type: SessionType.INTRO_15,
    });
    const created = tx.booking.create.mock.calls[0][0].data;
    expect(created.source).toHaveLength(200);
    expect(created.source).toBe('x'.repeat(200));
  });

  it('source не передан → null, а не undefined-строка', async () => {
    const { service, tx } = makeService();
    await service.book({
      ...BASE_DTO,
      startsAt: INSIDE_WINDOW,
      durationMin: 15,
      type: SessionType.INTRO_15,
    });
    const created = tx.booking.create.mock.calls[0][0].data;
    expect(created.source).toBeNull();
  });
});

describe('BookingService — assertSlotFree: граница cEnd>startsAt', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_NOW);
  });
  afterEach(() => jest.useRealTimers());

  it('существующая бронь заканчивается РОВНО в момент начала новой — конфликта нет (граница исключительная)', async () => {
    const existingEnd = INSIDE_WINDOW; // конец старой брони = начало новой
    const existingStart = new Date(existingEnd.getTime() - 50 * 60_000);
    const { service } = makeService({
      existingBookings: [
        {
          id: 1,
          startsAt: existingStart,
          durationMin: 50,
          status: BookingStatus.CONFIRMED,
        },
      ],
    });
    const res = await service.book({
      ...BASE_DTO,
      startsAt: INSIDE_WINDOW,
      durationMin: 15,
      type: SessionType.INTRO_15,
    });
    expect(res.status).toBe(BookingStatus.CONFIRMED);
  });

  it('существующая бронь заканчивается на 1мс позже начала новой — конфликт есть (EqualityOperator > vs >=)', async () => {
    const existingEnd = new Date(INSIDE_WINDOW.getTime() + 1);
    const existingStart = new Date(existingEnd.getTime() - 50 * 60_000);
    const { service } = makeService({
      existingBookings: [
        {
          id: 1,
          startsAt: existingStart,
          durationMin: 50,
          status: BookingStatus.CONFIRMED,
        },
      ],
    });
    await expect(
      service.book({
        ...BASE_DTO,
        startsAt: INSIDE_WINDOW,
        durationMin: 15,
        type: SessionType.INTRO_15,
      }),
    ).rejects.toThrow('Slot already taken');
  });
});

describe('BookingService.confirm — сообщения об ошибках и optional chaining на UNKNOWN', () => {
  function makeConfirmService(row: any) {
    const state = { row };
    const prisma: any = {
      booking: {
        findUnique: jest.fn(async ({ select }: any = {}) =>
          select
            ? state.row
              ? { status: state.row.status }
              : null
            : state.row,
        ),
        updateMany: jest.fn(async () => ({ count: 0 })), // никогда не забираем CAS
      },
    };
    const notify = { onConfirmed: jest.fn(async () => undefined) };
    const pricing = { getPrice: jest.fn(async () => 4000) };
    const service = new BookingService(
      prisma,
      notify as any,
      {} as any,
      {} as any,
      pricing as any,
      { get: () => undefined } as any,
    );
    return { service, state };
  }

  it('бронь не найдена вовсе → бросает ИМЕННО "Booking not found"', async () => {
    const { service } = makeConfirmService(null);
    await expect(service.confirm(1)).rejects.toThrow('Booking not found');
  });

  it('CAS не захватил (count=0) и повторный select тоже ничего не находит → сообщение содержит "UNKNOWN" (не падает на null)', async () => {
    // booking изначально существует (проходит первый findUnique без select),
    // но исчезает к моменту повторного select-запроса (гонка/удаление).
    let calls = 0;
    const prisma: any = {
      booking: {
        findUnique: jest.fn(async ({ select }: any = {}) => {
          calls++;
          if (select) return null; // второй запрос "не нашёл" статус
          return { id: 1, status: 'HELD' };
        }),
        updateMany: jest.fn(async () => ({ count: 0 })),
      },
    };
    const notify = { onConfirmed: jest.fn(async () => undefined) };
    const pricing = { getPrice: jest.fn(async () => 4000) };
    const service = new BookingService(
      prisma,
      notify as any,
      {} as any,
      {} as any,
      pricing as any,
      { get: () => undefined } as any,
    );
    await expect(service.confirm(1)).rejects.toThrow(
      'Cannot confirm booking in status UNKNOWN',
    );
    expect(calls).toBe(2);
  });
});

describe('BookingService.list — возвращает реальные расшифрованные строки (не undefined)', () => {
  it('каждая строка результата — расшифрованный объект брони, а не undefined (ArrowFunction map)', async () => {
    const rows = [
      {
        id: 1,
        status: BookingStatus.CONFIRMED,
        clientName: 'А',
        startsAt: new Date(),
      },
      {
        id: 2,
        status: BookingStatus.HELD,
        clientName: 'Б',
        startsAt: new Date(),
      },
    ];
    const prisma: any = {
      booking: { findMany: jest.fn(async () => rows) },
    };
    const service = new BookingService(
      prisma,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { get: () => undefined } as any,
    );
    const result = await service.list('all');
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: 1, clientName: 'А' });
    expect(result[1]).toMatchObject({ id: 2, clientName: 'Б' });
  });
});

describe('BookingService.cancel/getById/getPublicByToken — точные сообщения "не найдено"', () => {
  function makeSimpleService(bookingRow: any) {
    const state = { row: bookingRow };
    const prisma: any = {
      booking: {
        findUnique: jest.fn(async () => state.row),
      },
    };
    const service = new BookingService(
      prisma,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { get: () => undefined } as any,
    );
    return { service };
  }

  it('cancel: нет брони по токену → "Booking not found"', async () => {
    const { service } = makeSimpleService(null);
    await expect(service.cancel('nope')).rejects.toThrow('Booking not found');
  });

  it('getById: нет брони по id → "Booking not found"', async () => {
    const { service } = makeSimpleService(null);
    await expect(service.getById(1)).rejects.toThrow('Booking not found');
  });

  it('getPublicByToken: нет брони по токену → "Booking not found"', async () => {
    const { service } = makeSimpleService(null);
    await expect(service.getPublicByToken('nope')).rejects.toThrow(
      'Booking not found',
    );
  });
});
