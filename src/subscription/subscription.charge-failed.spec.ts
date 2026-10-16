import { markChargeFailed } from './subscription.charge-failed';

// Вебхук оплаты мог подтвердить charge раньше, чем сюда дошёл сбой ответа
// Robokassa: тогда подписку трогать нельзя (nextChargeAt уже на период вперёд,
// ретрай «через сутки» дал бы второе списание за оплаченный период).
function makePrisma(chargeCount: number) {
  const tx = {
    subscriptionCharge: {
      updateMany: jest.fn(async () => ({ count: chargeCount })),
    },
    subscription: { updateMany: jest.fn(async () => ({ count: 1 })) },
  };
  const prisma = {
    $transaction: jest.fn(async (fn: any) => fn(tx)),
  } as any;
  return { prisma, tx };
}

const base = { chargeId: 11, subId: 3, status: 'active' as const, maxFails: 3 };

describe('markChargeFailed', () => {
  it('charge уже paid (count 0) → false, подписка не тронута', async () => {
    const { prisma, tx } = makePrisma(0);
    await expect(markChargeFailed(prisma, { ...base, fails: 1 })).resolves.toBe(
      false,
    );
    expect(tx.subscriptionCharge.updateMany).toHaveBeenCalledWith({
      where: { id: 11, status: { not: 'paid' } },
      data: { status: 'failed' },
    });
    expect(tx.subscription.updateMany).not.toHaveBeenCalled();
  });

  it('сбой засчитан: ретрай через сутки, статус прежний, предикат статуса подписки', async () => {
    const { prisma, tx } = makePrisma(1);
    await expect(markChargeFailed(prisma, { ...base, fails: 1 })).resolves.toBe(
      true,
    );
    const arg = tx.subscription.updateMany.mock.calls[0][0] as any;
    expect(arg.where).toEqual({
      id: 3,
      status: { in: ['active', 'past_due'] },
    });
    expect(arg.data.failedAttempts).toBe(1);
    expect(arg.data.status).toBe('active');
    expect(arg.data.nextChargeAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('порог достигнут → past_due и nextChargeAt=null', async () => {
    const { prisma, tx } = makePrisma(1);
    await markChargeFailed(prisma, { ...base, fails: 3 });
    const arg = tx.subscription.updateMany.mock.calls[0][0] as any;
    expect(arg.data).toEqual({
      failedAttempts: 3,
      status: 'past_due',
      nextChargeAt: null,
    });
  });
});
