// Аудит 2026-10-11: в проде со снятыми ROBOKASSA_* платная сессия
// подтверждалась без денег (booking.checkout: `!robokassa.enabled` → CONFIRMED).
// Теперь book() отказывает 503 ДО INSERT и отдаёт заявку владельцу лидом;
// бесплатное знакомство и не-прод работают как раньше.
import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { BookingStatus, SessionType } from '@prisma/client';
import { BookingService } from './booking.service';

// В production crypto без ENCRYPTION_KEY отказывает писать — шифрование к теме
// теста не относится, подменяем его прозрачным.
jest.mock('../utils/crypto', () => ({
  ...jest.requireActual('../utils/crypto'),
  encryptRecord: (d: unknown) => d,
  decryptRecord: (r: unknown) => r,
}));

const FIXED_NOW = new Date('2026-07-13T00:00:00Z');
const INSIDE_WINDOW = new Date(FIXED_NOW.getTime() + 13 * 3_600_000);

function makeService(robokassaEnabled: boolean) {
  const tx = {
    $executeRaw: jest.fn(async () => undefined),
    booking: {
      findMany: jest.fn(async () => []),
      create: jest.fn(async ({ data }: any) => ({ id: 100, ...data })),
    },
  };
  const prisma: any = {
    availabilityRule: { findMany: jest.fn(async () => []) },
    slotOverride: { findMany: jest.fn(async () => []) },
    $transaction: jest.fn(async (fn: any) => fn(tx)),
    booking: { update: jest.fn(async () => ({})) },
  };
  const notify = {
    onConfirmed: jest.fn(async () => undefined),
    onAwaitingPayment: jest.fn(async () => undefined),
    notifyAdminBoth: jest.fn(async () => undefined),
  };
  const robokassa = {
    enabled: robokassaEnabled,
    buildPaymentUrl: jest.fn(() => 'https://robokassa.test/pay'),
  };
  const service = new BookingService(
    prisma,
    notify as any,
    { hasMeetingForContact: jest.fn(async () => true) } as any,
    robokassa as any,
    { getPrice: jest.fn(async () => 4000) } as any,
    { get: () => undefined } as any,
    { claimRun: jest.fn().mockResolvedValue(true) } as any,
  );
  return { service, prisma, tx, notify };
}

const dto = (type: SessionType) => ({
  clientName: 'Мария',
  clientContact: '@maria',
  acceptedOffer: true,
  startsAt: INSIDE_WINDOW,
  durationMin: type === SessionType.INTRO_15 ? 15 : 50,
  type,
});

describe('BookingService.book — Robokassa не настроена', () => {
  const was = process.env.NODE_ENV;
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_NOW);
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });
  afterEach(() => {
    process.env.NODE_ENV = was;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('прод + SESSION_50: 503, транзакция и INSERT не вызваны, лид владельцу с именем и контактом', async () => {
    process.env.NODE_ENV = 'production';
    const { service, prisma, tx, notify } = makeService(false);
    await expect(service.book(dto(SessionType.SESSION_50))).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.booking.create).not.toHaveBeenCalled();
    expect(notify.notifyAdminBoth).toHaveBeenCalledTimes(1);
    const [html] = notify.notifyAdminBoth.mock.calls[0] as unknown as [string];
    expect(html).toContain('Мария');
    expect(html).toContain('@maria');
    expect(notify.onConfirmed).not.toHaveBeenCalled();
  });

  it('контроль: прод + INTRO_15 — бесплатное знакомство подтверждается как раньше', async () => {
    process.env.NODE_ENV = 'production';
    const { service, notify } = makeService(false);
    const res = await service.book(dto(SessionType.INTRO_15));
    expect(res.status).toBe(BookingStatus.CONFIRMED);
    expect(notify.notifyAdminBoth).not.toHaveBeenCalled();
  });

  it('контроль: не прод + SESSION_50 — прежнее автоподтверждение для разработки', async () => {
    process.env.NODE_ENV = 'test';
    const { service } = makeService(false);
    const res = await service.book(dto(SessionType.SESSION_50));
    expect(res.status).toBe(BookingStatus.CONFIRMED);
  });

  it('контроль: прод + настроенная Robokassa — HELD со ссылкой на оплату', async () => {
    process.env.NODE_ENV = 'production';
    const { service } = makeService(true);
    const res = await service.book(dto(SessionType.SESSION_50));
    expect(res.status).toBe(BookingStatus.HELD);
    expect(res.paymentUrl).toBe('https://robokassa.test/pay');
  });
});
