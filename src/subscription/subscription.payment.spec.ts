// Регрессии на находки аудита 2026-07 (recurring-платежи):
//   P-3 — chargeDue не проверял существующий pending-charge: краш между
//         chargeRecurring и update nextChargeAt приводил ко ВТОРОМУ
//         реальному списанию на следующем hourly-тике.
//   P-2 — markChargePaid был check-then-act: параллельные ретраи webhook
//         задваивали активацию и алерты. Теперь CAS.
import {
  SubscriptionService,
  SUBSCRIPTION_INVID_BASE,
} from './subscription.service';

const SUB = {
  id: 1,
  status: 'active',
  period: 'month',
  amount: 300,
  failedAttempts: 0,
  firstInvId: 900001,
  telegramId: null,
  nextChargeAt: new Date(Date.now() - 1000),
};

function makeService(opts: { pendingCharge?: any; chargeRow?: any }) {
  const calls: Record<string, any[]> = { recurring: [], alerts: [] };
  const chargeState = opts.chargeRow ? { ...opts.chargeRow } : null;
  const prisma: any = {
    subscription: {
      findMany: jest.fn(async () => [SUB]),
      findUnique: jest.fn(async () => SUB),
      update: jest.fn(async () => SUB),
    },
    subscriptionCharge: {
      findFirst: jest.fn(async () => opts.pendingCharge ?? null),
      findUnique: jest.fn(async () => chargeState),
      create: jest.fn(async () => ({ id: 55, subscriptionId: 1, amount: 300 })),
      updateMany: jest.fn(async () => {
        if (!chargeState || chargeState.status === 'paid') return { count: 0 };
        chargeState.status = 'paid';
        return { count: 1 };
      }),
      update: jest.fn(async () => ({})),
    },
    $transaction: jest.fn(async (ops: any) =>
      Array.isArray(ops) ? Promise.all(ops) : ops(prisma),
    ),
  };
  const robokassa = {
    enabled: true,
    chargeRecurring: jest.fn(async (args: any) => {
      calls.recurring.push(args);
      return { ok: true, body: '' };
    }),
  };
  const notify = {
    alertAdmin: jest.fn(async (msg: string) => {
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

describe('SubscriptionService.chargeDue — защита от двойного списания (P-3)', () => {
  it('при свежем pending-charge НЕ списывает второй раз и алертит', async () => {
    const { service, robokassa, calls } = makeService({
      pendingCharge: { id: 44, status: 'pending', createdAt: new Date() },
    });
    await service.chargeDue();
    expect(robokassa.chargeRecurring).not.toHaveBeenCalled();
    expect(calls.alerts.length).toBe(1);
  });

  it('без pending-charge списание уходит и nextChargeAt сдвигается', async () => {
    const { service, robokassa, prisma } = makeService({});
    const before = Date.now();
    await service.chargeDue();
    expect(robokassa.chargeRecurring).toHaveBeenCalledTimes(1);
    // Списание уходит с правильным InvId нового платежа и previousInvId
    // подписки (Robokassa требует ссылку на первый платёж для рекуррента).
    expect(robokassa.chargeRecurring).toHaveBeenCalledWith(
      expect.objectContaining({
        invId: SUBSCRIPTION_INVID_BASE + 55, // id созданного charge из мока
        previousInvId: SUB.firstInvId,
        amount: SUB.amount,
      }),
    );
    expect(prisma.subscription.update).toHaveBeenCalledTimes(1);
    const updateArg = (prisma.subscription.update as jest.Mock).mock
      .calls[0][0];
    expect(updateArg.where).toEqual({ id: SUB.id });
    // nextChargeAt сдвинут вперёд, а не оставлен в прошлом (SUB.nextChargeAt — уже просроченная дата).
    expect(updateArg.data.nextChargeAt.getTime()).toBeGreaterThan(before);
  });
});

describe('SubscriptionService.markChargePaidByInvId — идемпотентность (P-2)', () => {
  it('первый webhook активирует, повторный — no-op без второго алерта', async () => {
    const { service, prisma, calls } = makeService({
      chargeRow: {
        id: 55,
        subscriptionId: 1,
        amount: 300,
        status: 'pending',
        isFirst: true,
      },
    });
    await service.markChargePaidByInvId(SUBSCRIPTION_INVID_BASE + 55, 300);
    const alertsAfterFirst = calls.alerts.length;
    expect(prisma.subscription.update).toHaveBeenCalledTimes(1);

    await service.markChargePaidByInvId(SUBSCRIPTION_INVID_BASE + 55, 300);
    expect(prisma.subscription.update).toHaveBeenCalledTimes(1); // не задвоилось
    expect(calls.alerts.length).toBe(alertsAfterFirst);
  });
});
