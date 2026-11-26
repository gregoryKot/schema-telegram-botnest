import { PushMetricsService } from './push-metrics.service';

function makeService(
  subs: Array<{ userId: bigint }>,
  events: Array<{ name: string; meta: unknown; userId: bigint | null }>,
) {
  const prisma = {
    pushSubscription: { findMany: jest.fn().mockResolvedValue(subs) },
    analyticsEvent: { findMany: jest.fn().mockResolvedValue(events) },
  };
  return { service: new PushMetricsService(prisma as never), prisma };
}

describe('PushMetricsService', () => {
  it('люди — уникальные userId подписок, устройства — строки', async () => {
    const { service } = makeService(
      [{ userId: 1n }, { userId: 1n }, { userId: 2n }],
      [],
    );
    const m = await service.getMetrics();
    expect(m.people).toBe(2);
    expect(m.devices).toBe(3);
  });

  it('серверные события — только со своей meta; подделка с клиента (meta null) не считается', async () => {
    const { service, prisma } = makeService(
      [],
      [
        {
          name: 'push_subscribed',
          meta: { delivered: true, service: 'fcm' },
          userId: 1n,
        },
        {
          name: 'push_subscribed',
          meta: { delivered: false, service: 'apple' },
          userId: 2n,
        },
        {
          name: 'push_subscribed',
          meta: { delivered: true, service: 'fcm' },
          userId: 1n,
        },
        { name: 'push_subscribed', meta: null, userId: 3n },
        { name: 'push_unsubscribed', meta: { reason: 'user' }, userId: 1n },
        { name: 'push_unsubscribed', meta: { reason: 'logout' }, userId: 2n },
        { name: 'push_unsubscribed', meta: null, userId: 3n },
        { name: 'push_gone', meta: { service: null }, userId: 4n },
        { name: 'push_gone', meta: null, userId: 4n },
        { name: 'push_denied', meta: null, userId: 5n },
        { name: 'push_denied', meta: null, userId: 5n },
        { name: 'push_denied', meta: null, userId: 6n },
      ],
    );
    const m = await service.getMetrics();
    expect(m.week).toEqual({
      enabled: 2,
      firstMissed: 1,
      disabled: 1,
      loggedOut: 1,
      denied: 2,
      gone: 1,
    });
    const arg = prisma.analyticsEvent.findMany.mock.calls[0][0];
    expect(arg.where.name.in).toEqual(
      expect.arrayContaining([
        'push_subscribed',
        'push_unsubscribed',
        'push_gone',
        'push_denied',
      ]),
    );
    expect(arg.where.createdAt.gte).toBeInstanceOf(Date);
  });

  it('render на пустой базе — строка без нулей', async () => {
    const { service } = makeService([], []);
    expect(await service.render()).toContain('пока никто не включал');
  });
});
