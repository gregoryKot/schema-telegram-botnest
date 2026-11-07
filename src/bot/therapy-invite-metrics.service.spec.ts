import { TherapyInviteMetricsService } from './therapy-invite-metrics.service';

// Один запрос по индексу (name, createdAt) вместо шести count с JSON-фильтром
// (гейт планов, правило №28); раскладка по step/kind — в памяти, чужое
// или неполное meta не считается.
describe('TherapyInviteMetricsService', () => {
  const now = new Date('2026-11-05T12:00:00Z');

  function setup(rows: { meta: unknown }[] = []) {
    const findMany = jest.fn(async () => rows);
    const svc = new TherapyInviteMetricsService({
      analyticsEvent: { findMany },
    } as any);
    return { svc, findMany };
  }

  it('один findMany: имя события и окно 30 дней, только meta', async () => {
    const { svc, findMany } = setup();
    await svc.getMetrics(now);
    expect(findMany).toHaveBeenCalledWith({
      where: {
        name: 'therapy_invite',
        createdAt: { gte: new Date(now.getTime() - 30 * 86_400_000) },
      },
      select: { meta: true },
    });
  });

  it('раскладывает строки по шагам и видам', async () => {
    const rows = [
      ...Array(5).fill({ meta: { step: 'created', kind: 'new' } }),
      ...Array(2).fill({ meta: { step: 'created', kind: 'offline' } }),
      ...Array(3).fill({ meta: { step: 'joined', kind: 'new' } }),
      { meta: { step: 'joined', kind: 'offline' } },
      ...Array(4).fill({ meta: { step: 'revoked', kind: 'new' } }),
    ];
    expect(await setup(rows).svc.getMetrics(now)).toEqual({
      created: { new: 5, offline: 2 },
      joined: { new: 3, offline: 1 },
      revoked: { new: 4, offline: 0 },
    });
  });

  it('строка без kind, с чужим step или без meta не считается', async () => {
    const rows = [
      { meta: { step: 'created' } },
      { meta: { step: 'opened', kind: 'new' } },
      { meta: { step: 'joined', kind: 'paper' } },
      { meta: null },
      { meta: 'created' },
      { meta: { step: 'joined', kind: 'offline' } },
    ];
    expect(await setup(rows).svc.getMetrics(now)).toEqual({
      created: { new: 0, offline: 0 },
      joined: { new: 0, offline: 1 },
      revoked: { new: 0, offline: 0 },
    });
  });

  it('render на пустой БД — «Пока ничего.»', async () => {
    expect(await setup().svc.render()).toContain('Пока ничего.');
  });
});
