import { TherapyInviteMetricsService } from './therapy-invite-metrics.service';

describe('TherapyInviteMetricsService', () => {
  const now = new Date('2026-11-05T12:00:00Z');

  function setup(impl?: (args: any) => number) {
    const count = jest.fn(async (args: any) => (impl ? impl(args) : 0));
    const svc = new TherapyInviteMetricsService({
      analyticsEvent: { count },
    } as any);
    return { svc, count };
  }

  const pairOf = (args: any) => ({
    step: args.where.AND.find((f: any) => f.meta.path[0] === 'step')?.meta
      .equals,
    kind: args.where.AND.find((f: any) => f.meta.path[0] === 'kind')?.meta
      .equals,
  });

  it('шесть count: имя события, окно 30 дней, пары step/kind', async () => {
    const { svc, count } = setup();
    await svc.getMetrics(now);
    expect(count).toHaveBeenCalledTimes(6);
    const since = new Date(now.getTime() - 30 * 86_400_000);
    const pairs = count.mock.calls.map(([args]) => {
      expect(args.where.name).toBe('therapy_invite');
      expect(args.where.createdAt.gte).toEqual(since);
      return pairOf(args);
    });
    expect(pairs).toEqual(
      expect.arrayContaining(
        ['created', 'joined', 'revoked'].flatMap((step) =>
          ['new', 'offline'].map((kind) => ({ step, kind })),
        ),
      ),
    );
  });

  it('фильтр по kind обязателен в каждом запросе: строка без kind не считается', async () => {
    const { svc, count } = setup();
    await svc.getMetrics(now);
    for (const [args] of count.mock.calls) {
      const { step, kind } = pairOf(args);
      expect(step).toBeDefined();
      expect(['new', 'offline']).toContain(kind);
      expect(args.where.AND).toHaveLength(2);
    }
  });

  it('раскладывает счётчики по шагам и видам', async () => {
    const table: Record<string, number> = {
      'created:new': 5,
      'created:offline': 2,
      'joined:new': 3,
      'joined:offline': 1,
      'revoked:new': 4,
      'revoked:offline': 0,
    };
    const { svc } = setup((a) => {
      const p = pairOf(a);
      return table[`${p.step}:${p.kind}`];
    });
    expect(await svc.getMetrics(now)).toEqual({
      created: { new: 5, offline: 2 },
      joined: { new: 3, offline: 1 },
      revoked: { new: 4, offline: 0 },
    });
  });

  it('render на пустой БД — «Пока ничего.»', async () => {
    const { svc } = setup();
    expect(await svc.render()).toContain('Пока ничего.');
  });
});
