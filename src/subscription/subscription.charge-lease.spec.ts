// Часовой chargeDue под арендой крона (правило №17): без неё второй инстанс
// на том же тике повторял бы выборку должников и pending-алерты владельцу.
// Аренда берётся после дешёвых гардов: выключенная подписка или Robokassa
// тик не забирают, и проба cronLeases судит аренду только при включённой
// подписке (cron-lease-expected.ts).
import { SubscriptionService } from './subscription.service';
import { chargeDue } from './subscription.charges';
import { LEASE_WINDOW } from '../infra/cron-leader.service';

function makeService(
  opts: { enabled?: boolean; robokassa?: boolean; leader?: boolean } = {},
) {
  const prisma: any = {
    subscription: { findMany: jest.fn().mockResolvedValue([]) },
    subscriptionCharge: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const cronLeader = {
    claimRun: jest.fn().mockResolvedValue(opts.leader ?? true),
  };
  const config = {
    get: (k: string) =>
      k === 'SUBSCRIPTION_ENABLED' && opts.enabled !== false
        ? 'true'
        : undefined,
  };
  const service = new SubscriptionService(
    prisma,
    { enabled: opts.robokassa ?? true } as any,
    { alertAdmin: jest.fn() } as any,
    config as any,
    cronLeader as any,
  );
  return { service, prisma, cronLeader };
}

describe('SubscriptionService.chargeDue — аренда крона', () => {
  it('лидер: аренда subscriptionChargeDue на час, затем выборка должников', async () => {
    const { service, prisma, cronLeader } = makeService();
    await service.chargeDue();
    expect(cronLeader.claimRun).toHaveBeenCalledWith(
      'subscriptionChargeDue',
      LEASE_WINDOW.hourly,
    );
    expect(prisma.subscription.findMany.mock.calls).toHaveLength(1);
  });

  it('тик забрал другой инстанс — ни выборки, ни списаний', async () => {
    const { service, prisma, cronLeader } = makeService({ leader: false });
    await expect(service.chargeDue()).resolves.toBeUndefined();
    expect(cronLeader.claimRun.mock.calls).toEqual([
      ['subscriptionChargeDue', LEASE_WINDOW.hourly],
    ]);
    expect(prisma.subscription.findMany.mock.calls).toEqual([]);
  });

  it.each([
    ['подписка выключена', { enabled: false }],
    ['Robokassa не настроена', { robokassa: false }],
  ])('%s — аренда не берётся (гард до claimRun)', async (_, opts) => {
    const { service, prisma, cronLeader } = makeService(opts);
    await expect(service.chargeDue()).resolves.toBeUndefined();
    expect(cronLeader.claimRun.mock.calls).toEqual([]);
    expect(prisma.subscription.findMany.mock.calls).toEqual([]);
  });
});

// Тот же гард в самом списании (subscription.charges.ts): вызов в обход крона
// сервиса с выключенной подпиской или Robokassa базу не трогает.
describe('chargeDue — свой гард флагов', () => {
  it.each([
    ['подписка выключена', { enabled: false, robokassa: { enabled: true } }],
    [
      'Robokassa не настроена',
      { enabled: true, robokassa: { enabled: false } },
    ],
  ])('%s — ни просрочек, ни выборки должников', async (_, flags) => {
    const prisma = {
      subscription: { findMany: jest.fn().mockResolvedValue([]) },
      subscriptionCharge: { findMany: jest.fn().mockResolvedValue([]) },
    };
    await chargeDue({ prisma, notify: {}, logger: {}, ...flags } as never);
    expect(prisma.subscriptionCharge.findMany).not.toHaveBeenCalled();
    expect(prisma.subscription.findMany).not.toHaveBeenCalled();
  });
});
