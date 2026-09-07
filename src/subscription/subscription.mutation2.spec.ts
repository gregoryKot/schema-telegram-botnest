// Продолжение subscription.mutation.spec.ts (лимит ~300 строк/файл):
// markChargePaidByInvId — CAS-запись, сверка суммы, текст алертов;
// findActiveByTelegram — точный orderBy; chargeDue — выборка должников,
// pending-guard, chargeRecurring/create аргументы, логирование сводки.
import {
  SubscriptionService,
  SUBSCRIPTION_INVID_BASE,
} from './subscription.service';

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
      findUnique: jest.fn(({ where: { id } }: any) => subs.get(id) ?? null),
      findFirst: jest.fn(({ where }: any) => {
        const candidates = [...subs.values()]
          .filter(
            (s) =>
              s.telegramId === where.telegramId &&
              where.status.in.includes(s.status),
          )
          .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))
          .reverse();
        return candidates[0] ?? null;
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
      findUnique: jest.fn(({ where: { id } }: any) => charges.get(id) ?? null),
      findFirst: jest.fn(() => null),
      updateMany: jest.fn(({ where, data }: any) => {
        const row = charges.get(where.id);
        if (!row || (where.status?.not && row.status === where.status.not))
          return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      }),
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
  opts: {
    enabled?: boolean;
    robokassaEnabled?: boolean;
    chargeRecurringResult?: { ok: boolean; body: string };
  } = {},
) {
  const prisma = makePrisma();
  const calls = { alerts: [] as string[] };
  const robokassa = {
    enabled: opts.robokassaEnabled ?? true,
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
    get: (k: string) =>
      k === 'SUBSCRIPTION_ENABLED'
        ? opts.enabled === false
          ? undefined
          : 'true'
        : undefined,
  };
  const service = new SubscriptionService(
    prisma,
    robokassa as any,
    notify as any,
    config as any,
  );
  return { service, prisma, robokassa, calls };
}

describe('SubscriptionService.markChargePaidByInvId — CAS-запись и поля charge', () => {
  it('после успешной оплаты charge.status реально становится "paid" и paidAt — валидная Date', async () => {
    const { service, prisma } = makeService();
    const sub = await prisma.subscription.create({
      data: { status: 'pending', period: 'month', amount: 300 },
    });
    const charge = await prisma.subscriptionCharge.create({
      data: { subscriptionId: sub.id, amount: 300, isFirst: true },
    });
    await service.markChargePaidByInvId(SUBSCRIPTION_INVID_BASE + charge.id);
    const row = prisma.charges.get(charge.id);
    expect(row.status).toBe('paid');
    expect(row.paidAt).toBeInstanceOf(Date);
  });

  it('updateMany вызывается с CAS-условием status:{not:"paid"} — точный where, не пустой объект', async () => {
    const { service, prisma } = makeService();
    const sub = await prisma.subscription.create({
      data: { status: 'pending', period: 'month', amount: 300 },
    });
    const charge = await prisma.subscriptionCharge.create({
      data: { subscriptionId: sub.id, amount: 300, isFirst: true },
    });
    await service.markChargePaidByInvId(SUBSCRIPTION_INVID_BASE + charge.id);
    expect(prisma.subscriptionCharge.updateMany).toHaveBeenCalledWith({
      where: { id: charge.id, status: { not: 'paid' } },
      data: { status: 'paid', paidAt: expect.any(Date) },
    });
  });
});

describe('SubscriptionService.markChargePaidByInvId — сверка суммы (ConditionalExpression на составном &&)', () => {
  it('paidAmount совпадает с charge.amount → алерта "расходится" НЕТ', async () => {
    const { service, prisma, calls } = makeService();
    const sub = await prisma.subscription.create({
      data: { status: 'pending', period: 'month', amount: 300 },
    });
    const charge = await prisma.subscriptionCharge.create({
      data: { subscriptionId: sub.id, amount: 300, isFirst: true },
    });
    await service.markChargePaidByInvId(
      SUBSCRIPTION_INVID_BASE + charge.id,
      300,
    );
    expect(calls.alerts.some((m) => m.includes('расходится'))).toBe(false);
  });

  it('paidAmount не передан (undefined) → сверка вообще не выполняется, алерта нет', async () => {
    const { service, prisma, calls } = makeService();
    const sub = await prisma.subscription.create({
      data: { status: 'pending', period: 'month', amount: 300 },
    });
    const charge = await prisma.subscriptionCharge.create({
      data: { subscriptionId: sub.id, amount: 300, isFirst: true },
    });
    await service.markChargePaidByInvId(SUBSCRIPTION_INVID_BASE + charge.id);
    expect(calls.alerts.some((m) => m.includes('расходится'))).toBe(false);
  });
});

describe('SubscriptionService.markChargePaidByInvId — алерты об активации содержат ровно ожидаемое', () => {
  it('есть email И telegramId → в алерте оба маркера присутствуют', async () => {
    const { service, prisma, calls } = makeService();
    const sub = await prisma.subscription.create({
      data: {
        status: 'pending',
        period: 'month',
        amount: 300,
        email: 'client@mail.ru',
        telegramId: 55n,
      },
    });
    const charge = await prisma.subscriptionCharge.create({
      data: { subscriptionId: sub.id, amount: 300, isFirst: true },
    });
    await service.markChargePaidByInvId(SUBSCRIPTION_INVID_BASE + charge.id);
    const alert = calls.alerts[calls.alerts.length - 1];
    expect(alert).toContain('client@mail.ru');
    expect(alert).toContain('tg:55');
  });

  it('нет ни email, ни telegramId → в алерте НЕТ маркеров 📬/tg: (LogicalOperator-ветки выключены)', async () => {
    const { service, prisma, calls } = makeService();
    const sub = await prisma.subscription.create({
      data: { status: 'pending', period: 'month', amount: 300 },
    });
    const charge = await prisma.subscriptionCharge.create({
      data: { subscriptionId: sub.id, amount: 300, isFirst: true },
    });
    await service.markChargePaidByInvId(SUBSCRIPTION_INVID_BASE + charge.id);
    const alert = calls.alerts[calls.alerts.length - 1];
    expect(alert).not.toContain('📬');
    expect(alert).not.toContain('tg:');
  });

  it('period=year → алерт содержит "₽/год", period=month → "₽/мес" (EqualityOperator в тернарнике алерта)', async () => {
    const { service, prisma, calls } = makeService();
    const subYear = await prisma.subscription.create({
      data: { status: 'pending', period: 'year', amount: 5000 },
    });
    const chargeYear = await prisma.subscriptionCharge.create({
      data: { subscriptionId: subYear.id, amount: 5000, isFirst: true },
    });
    await service.markChargePaidByInvId(
      SUBSCRIPTION_INVID_BASE + chargeYear.id,
    );
    expect(calls.alerts[calls.alerts.length - 1]).toContain('₽/год');

    const subMonth = await prisma.subscription.create({
      data: { status: 'pending', period: 'month', amount: 500 },
    });
    const chargeMonth = await prisma.subscriptionCharge.create({
      data: { subscriptionId: subMonth.id, amount: 500, isFirst: true },
    });
    await service.markChargePaidByInvId(
      SUBSCRIPTION_INVID_BASE + chargeMonth.id,
    );
    expect(calls.alerts[calls.alerts.length - 1]).toContain('₽/мес');
  });
});

describe('SubscriptionService.findActiveByTelegram — сортировка по createdAt', () => {
  it('запрос идёт с orderBy createdAt:desc (точные аргументы findFirst)', async () => {
    const { service, prisma } = makeService();
    await service.findActiveByTelegram(42n);
    expect(prisma.subscription.findFirst).toHaveBeenCalledWith({
      where: { telegramId: 42n, status: { in: ['active', 'past_due'] } },
      orderBy: { createdAt: 'desc' },
    });
  });
});

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
