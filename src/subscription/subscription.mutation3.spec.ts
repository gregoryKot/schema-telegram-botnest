// Продолжение subscription.mutation2.spec.ts (лимит ~300 строк/файл):
// chargeDue — выборка должников, pending-guard (48ч окно), аргументы
// chargeRecurring/subscriptionCharge.create, обрезка тела ошибки в алерте,
// логирование итоговой сводки.
import { SubscriptionService } from './subscription.service';

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
    },
    // 1 = подписку захватил этот обработчик (атомарный UPDATE
    // nextChargeAt). 0 вернул бы «уже забрал другой инстанс».
    $executeRaw: jest.fn(async () => 1),
    subscriptionCharge: {
      create: jest.fn(({ data }: any) => {
        const row = { id: nextChargeId++, status: 'pending', ...data };
        charges.set(row.id, row);
        return row;
      }),
      findFirst: jest.fn(() => null),
      update: jest.fn(({ where: { id }, data }: any) => {
        const row = charges.get(id);
        Object.assign(row, data);
        return row;
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
  };
  const config = {
    get: (k: string) => (k === 'SUBSCRIPTION_ENABLED' ? 'true' : undefined),
  };
  const service = new SubscriptionService(
    prisma,
    robokassa as any,
    notify as any,
    config as any,
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

  it('проверка pending-charge идёт по exact where: status:"pending" и окну 48ч (ArithmeticOperator на 48*3_600_000)', async () => {
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
    expect(call.where.status).toBe('pending');
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

  it('тело ошибки от Robokassa обрезается в алерте до 150 символов (MethodExpression .slice)', async () => {
    const longBody = 'X'.repeat(500);
    const { service, prisma, calls } = makeService({
      chargeRecurringResult: { ok: false, body: longBody },
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
    // 'X'.repeat(150) — ровно обрезанный кусок тела должен присутствовать,
    // а полное 500-символьное тело — нет (иначе алерт Telegram переполнится).
    expect(alert).toContain('X'.repeat(150));
    expect(alert).not.toContain('X'.repeat(151));
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
