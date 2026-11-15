// Продолжение subscription.mutation.spec.ts (лимит ~300 строк/файл):
// markChargePaidByInvId — CAS-запись, сверка суммы, текст алертов;
// findActiveByTelegram — точный orderBy. chargeDue — subscription.mutation3.spec.ts.
import {
  SubscriptionService,
  SUBSCRIPTION_INVID_BASE,
} from './subscription.service';
import { subscriptionUpdateMany } from '../test-support/subscription-update-many';

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
      update: jest.fn(({ where: { id }, data }: any) => {
        const row = subs.get(id);
        Object.assign(row, data);
        return row;
      }),
      updateMany: subscriptionUpdateMany(subs),
    },
    subscriptionCharge: {
      create: jest.fn(({ data }: any) => {
        const row = { id: nextChargeId++, status: 'pending', ...data };
        charges.set(row.id, row);
        return row;
      }),
      findUnique: jest.fn(({ where: { id } }: any) => charges.get(id) ?? null),
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
  } = {},
) {
  const prisma = makePrisma();
  const calls = { alerts: [] as string[], emails: [] as string[] };
  const robokassa = {
    enabled: opts.robokassaEnabled ?? true,
    buildPaymentUrl: jest.fn(),
  };
  const notify = {
    alertAdmin: jest.fn((msg: string) => {
      calls.alerts.push(msg);
    }),
    // Карточка оплаты — в оба канала; в alerts — то, что видно в Telegram.
    notifyAdminBoth: jest.fn((html: { telegram: string; email: string }) => {
      calls.alerts.push(html.telegram);
      calls.emails.push(html.email);
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
    { claimRun: jest.fn().mockResolvedValue(true) } as any, // аренда крона — своя
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
  it('есть email И telegramId → в Telegram их нет, в письме — оба', async () => {
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
    expect(alert).not.toContain('client@mail.ru');
    expect(alert).not.toContain('tg:55');
    expect(alert).toContain('в письме на почте');
    expect(calls.emails.at(-1)).toContain('client@mail.ru');
    expect(calls.emails.at(-1)).toContain('tg:55');
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
    expect(alert).not.toContain('📧');
    for (const text of [alert, calls.emails.at(-1)]) {
      expect(text).not.toContain('📬');
      expect(text).not.toContain('tg:');
    }
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
