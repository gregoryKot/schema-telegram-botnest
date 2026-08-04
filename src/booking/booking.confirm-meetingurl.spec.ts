// Точечное усиление против выживших мутантов booking.service.ts:
// meetingUrl ?? null (LogicalOperator), paidAmount != null guard
// (ConditionalExpression), точные аргументы повторного findUnique в CAS-ретрае.
import { BookingStatus, SessionType } from '@prisma/client';
import { BookingService } from './booking.service';

const FIXED_NOW = new Date('2026-07-13T00:00:00Z');
const INSIDE_WINDOW = new Date(FIXED_NOW.getTime() + 13 * 3_600_000);

describe('BookingService.book — meetingUrl ?? null: правда пробрасывается, не гасится', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_NOW);
  });
  afterEach(() => jest.useRealTimers());

  function makeService() {
    const tx = {
      $queryRaw: jest.fn(async () => undefined),
      booking: {
        findMany: jest.fn(async () => []),
        // Симулируем бронь, у которой meetingUrl уже проставлен (реалистичный
        // сценарий — встреча создана синхронно при бронировании).
        create: jest.fn(async ({ data }: any) => ({
          id: 100,
          meetingUrl: 'https://meet.test/abc',
          ...data,
        })),
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
    const meeting = { hasMeetingForContact: jest.fn(async () => true) };
    const robokassa = { enabled: false, buildPaymentUrl: jest.fn() };
    const pricing = { getPrice: jest.fn(async () => 4000) };
    const service = new BookingService(
      prisma,
      notify as any,
      meeting as any,
      robokassa as any,
      pricing as any,
      { get: () => undefined } as any,
    );
    return { service };
  }

  it('INTRO_15: meetingUrl уже есть на строке брони → отдаётся как есть (не null из-за ?? → && мутации)', async () => {
    const { service } = makeService();
    const res = await service.book({
      clientName: 'Мария',
      clientContact: '@maria',
      acceptedOffer: true,
      startsAt: INSIDE_WINDOW,
      durationMin: 15,
      type: SessionType.INTRO_15,
    });
    expect(res.meetingUrl).toBe('https://meet.test/abc');
  });

  it('SESSION_50 + Robokassa выключена (dev auto-confirm): meetingUrl тоже пробрасывается', async () => {
    const { service } = makeService();
    const res = await service.book({
      clientName: 'Мария',
      clientContact: '@maria',
      acceptedOffer: true,
      startsAt: INSIDE_WINDOW,
      durationMin: 50,
      type: SessionType.SESSION_50,
    });
    expect(res.meetingUrl).toBe('https://meet.test/abc');
  });

  it('нет meetingUrl на строке → возвращается ровно null (не undefined)', async () => {
    const tx = {
      $queryRaw: jest.fn(async () => undefined),
      booking: {
        findMany: jest.fn(async () => []),
        create: jest.fn(async ({ data }: any) => ({ id: 100, ...data })),
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
    const meeting = { hasMeetingForContact: jest.fn(async () => true) };
    const robokassa = { enabled: false, buildPaymentUrl: jest.fn() };
    const pricing = { getPrice: jest.fn(async () => 4000) };
    const service = new BookingService(
      prisma,
      notify as any,
      meeting as any,
      robokassa as any,
      pricing as any,
      { get: () => undefined } as any,
    );
    const res = await service.book({
      clientName: 'Мария',
      clientContact: '@maria',
      acceptedOffer: true,
      startsAt: INSIDE_WINDOW,
      durationMin: 15,
      type: SessionType.INTRO_15,
    });
    expect(res.meetingUrl).toBeNull();
  });
});

describe('BookingService.confirm — paidAmount не передан → сверка суммы вообще не выполняется', () => {
  it('confirm(id) без второго аргумента подтверждает бронь без PaymentAmountMismatchError, даже если pricing другая', async () => {
    const state = {
      row: {
        id: 9,
        status: BookingStatus.HELD,
        type: SessionType.SESSION_50,
        startsAt: new Date(),
        durationMin: 50,
      },
    };
    const prisma: any = {
      booking: {
        findUnique: jest.fn(async () => state.row),
        updateMany: jest.fn(async ({ data }: any) => {
          Object.assign(state.row, data);
          return { count: 1 };
        }),
      },
    };
    const notify = { onConfirmed: jest.fn(async () => undefined) };
    // Цена "изменилась" — если бы (paidAmount != null) мутировал в "всегда true",
    // Math.round(undefined) → NaN !== expected → ложный mismatch.
    const pricing = { getPrice: jest.fn(async () => 9999) };
    const service = new BookingService(
      prisma,
      notify as any,
      {} as any,
      {} as any,
      pricing as any,
      { get: () => undefined } as any,
    );
    await expect(service.confirm(9)).resolves.toEqual({ ok: true });
    expect(state.row.status).toBe(BookingStatus.CONFIRMED);
  });
});

describe('BookingService.confirm — повторный findUnique в CAS-ретрае бьёт точным where/select', () => {
  it('запрос статуса идёт с where:{id} и select:{status:true} (не пустые объекты)', async () => {
    const prisma: any = {
      booking: {
        findUnique: jest.fn(async ({ select }: any = {}) => {
          if (select) return { status: BookingStatus.CONFIRMED };
          return { id: 3, status: BookingStatus.HELD };
        }),
        updateMany: jest.fn(async () => ({ count: 0 })), // CAS проигран
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
    await expect(service.confirm(3, 4000)).resolves.toEqual({ ok: true });
    const secondCallArgs = prisma.booking.findUnique.mock.calls[1][0];
    expect(secondCallArgs).toEqual({
      where: { id: 3 },
      select: { status: true },
    });
  });
});
