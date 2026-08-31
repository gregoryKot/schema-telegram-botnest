// Продолжение booking.mutation.spec.ts / booking.confirm-meetingurl.spec.ts /
// booking.exact-where.spec.ts (лимит ~300 строк/файл). Закрывает остаток
// выживших мутантов из reports/mutation/check.json:
//   - isFree-ветка book() реально КОРОТКОЗАМЫКАЕТ выполнение (BlockStatement/
//     ConditionalExpression на if(isFree)) — Robokassa не выключена нигде
//     ниже по коду, и без короткого замыкания пустой блок дал бы тот же
//     видимый результат при выключенной Robokassa (dev-автоподтверждение),
//     поэтому тест держит Robokassa ВКЛЮЧЁННОЙ, где расхождение видно.
//   - точные тексты ошибок и exact where на confirm()/cancel()/advisory-lock/
//     assertWithinAvailability, которые раньше проверялись только по классу
//     исключения или вообще не проверялись.
import { BookingStatus, SessionType } from '@prisma/client';
import { assertWithinAvailability } from './booking.availability';
import { BookingService, PaymentAmountMismatchError } from './booking.service';

const FIXED_NOW = new Date('2026-07-13T00:00:00Z');
const INSIDE_WINDOW = new Date(FIXED_NOW.getTime() + 13 * 3_600_000);
// Приватная константа booking.service.ts (advisory-lock ключ) — дублируем
// намеренно, тест ловит именно СОДЕРЖИМОЕ SQL-шаблона, не саму константу.
const LOCK_KEY_FOR_TEST = 911_001;

describe('BookingService.book — if(isFree) реально короткозамыкает платный путь', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_NOW);
  });
  afterEach(() => jest.useRealTimers());

  it('INTRO_15 с ВКЛЮЧЁННОЙ Robokassa — pricing/buildPaymentUrl НЕ вызываются вовсе', async () => {
    let nextId = 100;
    const tx = {
      $queryRaw: jest.fn(async () => undefined),
      booking: {
        findMany: jest.fn(async () => []),
        create: jest.fn(async ({ data }: any) => ({ id: nextId++, ...data })),
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
    const robokassa = {
      enabled: true, // критично: если бы блок isFree не короткозамыкал, дошли бы сюда
      buildPaymentUrl: jest.fn(() => 'https://auth.robokassa.ru/pay?x=1'),
    };
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
    expect(res.status).toBe(BookingStatus.CONFIRMED);
    expect(res.paymentUrl).toBeNull();
    expect(pricing.getPrice).not.toHaveBeenCalled();
    expect(robokassa.buildPaymentUrl).not.toHaveBeenCalled();
    expect(notify.onAwaitingPayment).not.toHaveBeenCalled();
    expect(notify.onConfirmed).toHaveBeenCalledTimes(1);
  });
});

describe('BookingService.book — точное сообщение об отсутствии имени/контакта', () => {
  it('нет clientName/clientContact → сообщение ИМЕННО "Name and contact required"', async () => {
    const prisma: any = {};
    const service = new BookingService(
      prisma,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { get: () => undefined } as any,
    );
    await expect(
      service.book({
        clientName: '',
        clientContact: '',
        acceptedOffer: true,
        startsAt: INSIDE_WINDOW,
        durationMin: 15,
        type: SessionType.INTRO_15,
      }),
    ).rejects.toThrow(
      expect.objectContaining({ message: 'Name and contact required' }),
    );
  });
});

describe('BookingService.book — advisory-lock реально блокирует по нужному ключу', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_NOW);
  });
  afterEach(() => jest.useRealTimers());

  it('$queryRaw уходит с pg_advisory_xact_lock и правильным числовым ключом (не пустой запрос)', async () => {
    let nextId = 100;
    const tx = {
      $queryRaw: jest.fn(async () => undefined),
      booking: {
        findMany: jest.fn(async () => []),
        create: jest.fn(async ({ data }: any) => ({ id: nextId++, ...data })),
      },
    };
    const prisma: any = {
      availabilityRule: { findMany: jest.fn(async () => []) },
      $transaction: jest.fn(async (fn: any) => fn(tx)),
    };
    const notify = { onConfirmed: jest.fn(async () => undefined) };
    const meeting = { hasMeetingForContact: jest.fn(async () => true) };
    const service = new BookingService(
      prisma,
      notify as any,
      meeting as any,
      { enabled: false } as any,
      {} as any,
      { get: () => undefined } as any,
    );
    await service.book({
      clientName: 'Мария',
      clientContact: '@maria',
      acceptedOffer: true,
      startsAt: INSIDE_WINDOW,
      durationMin: 15,
      type: SessionType.INTRO_15,
    });
    const [strings, ...values] = tx.$queryRaw.mock.calls[0];
    expect(strings.join('')).toContain('pg_advisory_xact_lock');
    expect(values[0]).toBe(LOCK_KEY_FOR_TEST);
  });
});

describe('BookingService.confirm — findUnique уходит с точным where:{id}', () => {
  it('где не пустой объект — конкретный id из аргумента', async () => {
    const prisma: any = {
      booking: {
        findUnique: jest.fn(async () => null),
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
    await expect(service.confirm(77)).rejects.toThrow('Booking not found');
    expect(prisma.booking.findUnique).toHaveBeenCalledWith({
      where: { id: 77 },
    });
  });
});

describe('BookingService.confirm — расхождение суммы: текст алерта и сообщения об ошибке', () => {
  it('алерт админу содержит id брони, ожидаемую и полученную сумму; ошибка — точный текст', async () => {
    const row = {
      id: 42,
      status: BookingStatus.HELD,
      type: SessionType.SESSION_50,
      startsAt: new Date(),
      durationMin: 50,
    };
    const prisma: any = {
      booking: { findUnique: jest.fn(async () => row) },
    };
    const alerts: string[] = [];
    const notify = {
      alertAdmin: jest.fn(async (msg: string) => {
        alerts.push(msg);
      }),
    };
    const pricing = { getPrice: jest.fn(async () => 4000) };
    const service = new BookingService(
      prisma,
      notify as any,
      {} as any,
      {} as any,
      pricing as any,
      { get: () => undefined } as any,
    );
    await expect(service.confirm(42, 1)).rejects.toThrow(
      expect.objectContaining({ message: 'Amount mismatch — manual review' }),
    );
    await expect(service.confirm(42, 1)).rejects.toBeInstanceOf(
      PaymentAmountMismatchError,
    );
    expect(alerts[0]).toContain('Бронь #42');
    expect(alerts[0]).toContain('Ожидали 4000 ₽');
    expect(alerts[0]).toContain('оплатили 1 ₽');
  });
});

describe('BookingService.cancel — update уходит с точным where:{cancelToken}', () => {
  it('успешная отмена шлёт update именно по тому токену, что пришёл (не пустой объект)', async () => {
    const row = {
      id: 9,
      status: BookingStatus.HELD,
      startsAt: new Date(Date.now() + 48 * 3_600_000),
      calDavUid: null,
    };
    const prisma: any = {
      booking: {
        findUnique: jest.fn(async () => row),
        update: jest.fn(async ({ data }: any) => Object.assign(row, data)),
      },
    };
    const notify = { onCancelled: jest.fn(async () => undefined) };
    const service = new BookingService(
      prisma,
      notify as any,
      {} as any,
      {} as any,
      {} as any,
      { get: () => undefined } as any,
    );
    await service.cancel('tok-cancel-me');
    expect(prisma.booking.update).toHaveBeenCalledWith({
      where: { cancelToken: 'tok-cancel-me' },
      data: { status: BookingStatus.CANCELLED, heldUntil: null },
    });
  });
});

describe('BookingService.assertWithinAvailability — точный where:{isActive:true}', () => {
  it('findMany вызывается ровно с {isActive:true}, а не пустым фильтром', async () => {
    const prisma: any = {
      availabilityRule: { findMany: jest.fn(async () => []) },
    };
    await assertWithinAvailability(prisma, new Date(), 50);
    expect(prisma.availabilityRule.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
    });
  });
});
