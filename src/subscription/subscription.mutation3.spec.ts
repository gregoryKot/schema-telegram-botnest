// Продолжение subscription.mutation2.spec.ts (лимит ~300 строк/файл):
// chargeDue — выборка должников, pending-guard (48ч окно), аргументы
// chargeRecurring/subscriptionCharge.create, обрезка тела ошибки в алерте,
// логирование итоговой сводки.
import { SubscriptionService } from './subscription.service';
import { Logger } from '@nestjs/common';
import { subscriptionUpdateMany } from '../test-support/subscription-update-many';
import { PII, expectNoMarkers } from '../test-support/pii-markers';

function makePrisma() {
  const subs = new Map<number, any>();
  const charges = new Map<number, any>();
  let nextChargeId = 1;

  const prisma: any = {
    subs,
    charges,
    subscription: {
      create: jest.fn(({ data }: any) => {
        const row = { id: subs.size + 1, failedAttempts: 0, ...data };
        subs.set(row.id, row);
        return row;
      }),
      findMany: jest.fn(({ where }: any) =>
        [...subs.values()].filter(
          (s) =>
            where.status.in.includes(s.status) &&
            s.nextChargeAt != null &&
            s.nextChargeAt <= where.nextChargeAt.lte &&
            s.firstInvId != null,
        ),
      ),
      update: jest.fn(({ where: { id }, data }: any) => {
        const row = subs.get(id);
        Object.assign(row, data);
        return row;
      }),
      updateMany: subscriptionUpdateMany(subs),
    },
    // 1 = подписку захватил этот обработчик (атомарный UPDATE
    // nextChargeAt). 0 вернул бы «уже забрал другой инстанс».
    $executeRaw: jest.fn(async () => 1),
    subscriptionCharge: {
      // Просроченные продления (R8, charge-guards.ts) — здесь их нет.
      findMany: jest.fn(async () => []),
      create: jest.fn(({ data }: any) => {
        const row = { id: nextChargeId++, status: 'pending', ...data };
        charges.set(row.id, row);
        return row;
      }),
      findFirst: jest.fn(() => null),
      updateMany: jest.fn(({ where, data }: any) => {
        const row = charges.get(where.id);
        if (!row || (where.status?.not && row.status === where.status.not))
          return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      }),
    },
    $transaction: jest.fn((ops: any) =>
      Array.isArray(ops) ? Promise.all(ops) : ops(prisma),
    ),
  };
  return prisma;
}

function makeService(
  opts: { chargeRecurringResult?: { ok: boolean; body: string } } = {},
) {
  const prisma = makePrisma();
  const calls = { alerts: [] as string[] };
  const robokassa = {
    enabled: true,
    buildPaymentUrl: jest.fn(),
    chargeRecurring: jest.fn(
      (_args: any) => opts.chargeRecurringResult ?? { ok: true, body: '' },
    ),
  };
  const notify = {
    alertAdmin: jest.fn((msg: string) => {
      calls.alerts.push(msg);
    }),
    // Карточка оплаты — в оба канала; в alerts — то, что видно в Telegram.
    notifyAdminBoth: jest.fn((html: { telegram: string }) => {
      calls.alerts.push(html.telegram);
    }),
  };
  const config = {
    get: (k: string) => (k === 'SUBSCRIPTION_ENABLED' ? 'true' : undefined),
  };
  const service = new SubscriptionService(
    prisma,
    robokassa as any,
    notify as any,
    config as any,
    { claimRun: jest.fn().mockResolvedValue(true) } as any, // аренда крона — своя
  );
  return { service, prisma, robokassa, calls };
}

describe('SubscriptionService.chargeDue — точные аргументы выборки должников', () => {
  it('findMany вызывается с status.in ["active","past_due"] и firstInvId:{not:null}', async () => {
    const { service, prisma } = makeService();
    await service.chargeDue();
    expect(prisma.subscription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['active', 'past_due'] },
          firstInvId: { not: null },
        }),
      }),
    );
  });

  // R8 (аудит 2026-11): P-3 смотрит и failed — таймаут ответа тоже failed.
  it('проверка свежего charge идёт по exact where: status in [pending, failed] и окну 48ч (ArithmeticOperator на 48*3_600_000)', async () => {
    const { service, prisma } = makeService();
    const now = new Date('2026-08-01T12:00:00Z');
    jest.useFakeTimers();
    jest.setSystemTime(now);
    await prisma.subscription.create({
      data: {
        status: 'active',
        period: 'month',
        amount: 300,
        firstInvId: 900001,
        failedAttempts: 0,
        nextChargeAt: new Date(now.getTime() - 1000),
      },
    });
    await service.chargeDue();
    jest.useRealTimers();
    const call = prisma.subscriptionCharge.findFirst.mock.calls[0][0];
    expect(call.where.status).toEqual({ in: ['pending', 'failed'] });
    const expectedGte = now.getTime() - 48 * 3_600_000;
    expect(call.where.createdAt.gte.getTime()).toBe(expectedGte);
  });

  it('chargeRecurring вызывается с desc "год" при period=year, "месяц" при period=month', async () => {
    const { service, prisma, robokassa } = makeService();
    await prisma.subscription.create({
      data: {
        status: 'active',
        period: 'year',
        amount: 5000,
        firstInvId: 900001,
        failedAttempts: 0,
        nextChargeAt: new Date(Date.now() - 1000),
      },
    });
    await service.chargeDue();
    expect(robokassa.chargeRecurring.mock.calls[0][0].desc).toBe(
      'Подписка SchemeHappens (год)',
    );
  });

  it('subscriptionCharge.create вызывается с data:{subscriptionId,amount} — точные поля, не пустой объект', async () => {
    const { service, prisma } = makeService();
    const sub = await prisma.subscription.create({
      data: {
        status: 'active',
        period: 'month',
        amount: 777,
        firstInvId: 900001,
        failedAttempts: 0,
        nextChargeAt: new Date(Date.now() - 1000),
      },
    });
    await service.chargeDue();
    expect(prisma.subscriptionCharge.create).toHaveBeenCalledWith({
      data: { subscriptionId: sub.id, amount: 777 },
    });
  });

  it('ответ Robokassa в Telegram-алерт не попадает — только в warn-лог приложения', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const { service, prisma, calls } = makeService({
      chargeRecurringResult: { ok: false, body: PII.robokassa },
    });
    await prisma.subscription.create({
      data: {
        status: 'active',
        period: 'month',
        amount: 300,
        firstInvId: 900001,
        failedAttempts: 0,
        nextChargeAt: new Date(Date.now() - 1000),
      },
    });
    await service.chargeDue();
    const alert = calls.alerts[calls.alerts.length - 1];
    expect(alert).toContain('Не удалось списать подписку');
    expect(alert).toContain('Ответ Robokassa — в логе приложения');
    expectNoMarkers(alert);
    const logged = warn.mock.calls.map((c) => String(c[0]));
    expect(logged.some((l) => l.includes(PII.robokassa))).toBe(true);
    warn.mockRestore();
  });

  // Аудит 2026-10-11 (booking-cas): пометка списания failed — только с
  // предикатом статуса, иначе она затёрла бы оплаченное вебхуком списание.
  it('отказ Robokassa помечает списание failed через updateMany с предикатом status not paid', async () => {
    const { service, prisma } = makeService({
      chargeRecurringResult: { ok: false, body: 'denied' },
    });
    await prisma.subscription.create({
      data: {
        status: 'active',
        period: 'month',
        amount: 300,
        firstInvId: 900001,
        failedAttempts: 0,
        nextChargeAt: new Date(Date.now() - 1000),
      },
    });
    await service.chargeDue();
    expect(prisma.subscriptionCharge.updateMany).toHaveBeenCalledWith({
      where: { id: expect.any(Number), status: { not: 'paid' } },
      data: { status: 'failed' },
    });
  });

  it('due.length===0 → this.logger.log НЕ вызывается со сводкой "Processed" (ConditionalExpression)', async () => {
    const { service } = makeService();
    const logSpy = jest.fn();
    (service as any).logger.log = logSpy;
    await service.chargeDue(); // нет должников в этом прогоне
    expect(
      logSpy.mock.calls.some((c) => String(c[0]).includes('Processed')),
    ).toBe(false);
  });

  it('due.length>0 → this.logger.log ВЫЗЫВАЕТСЯ со сводкой "Processed" (обратная ветка того же условия)', async () => {
    const { service, prisma } = makeService();
    await prisma.subscription.create({
      data: {
        status: 'active',
        period: 'month',
        amount: 300,
        firstInvId: 900001,
        failedAttempts: 0,
        nextChargeAt: new Date(Date.now() - 1000),
      },
    });
    const logSpy = jest.fn();
    (service as any).logger.log = logSpy;
    await service.chargeDue();
    expect(
      logSpy.mock.calls.some((c) => String(c[0]).includes('Processed')),
    ).toBe(true);
  });
});
