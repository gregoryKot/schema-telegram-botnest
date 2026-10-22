import { NotifyQueueMetricsService } from './notify-queue-metrics.service';

const NOW = new Date('2026-10-16T12:00:00Z').getTime();
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000);

function makeService(rows: Array<{ meta: unknown; createdAt: Date }>) {
  const findMany = jest.fn().mockResolvedValue(rows);
  const prisma = { analyticsEvent: { findMany } } as never;
  return { service: new NotifyQueueMetricsService(prisma), findMany };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
});
afterEach(() => jest.useRealTimers());

describe('NotifyQueueMetricsService', () => {
  it('берёт только серверные строки события за неделю', async () => {
    const { service, findMany } = makeService([]);
    await service.getMetrics();
    expect(findMany).toHaveBeenCalledWith({
      where: {
        name: 'notify_queue_tick',
        userId: null,
        createdAt: { gte: new Date(NOW - 7 * 86_400_000) },
      },
      select: { meta: true, createdAt: true },
    });
  });

  it('суммирует сутки и неделю раздельно', async () => {
    const { service } = makeService([
      {
        meta: { sent: 10, transient: 1, waited: 1, deferred: 5 },
        createdAt: hoursAgo(1),
      },
      {
        meta: { sent: 20, transient: 0, waited: 0, deferred: 0 },
        createdAt: hoursAgo(30),
      },
    ]);
    const m = await service.getMetrics();
    expect(m.day).toEqual({
      ticks: 1,
      sent: 10,
      transient: 1,
      waited: 1,
      deferred: 5,
    });
    expect(m.week).toEqual({
      ticks: 2,
      sent: 30,
      transient: 1,
      waited: 1,
      deferred: 5,
    });
  });

  it('мусор в meta (null, строки, минус) считается нулём, а не NaN', async () => {
    const { service } = makeService([
      { meta: null, createdAt: hoursAgo(1) },
      {
        meta: { sent: '5', transient: -2, waited: Number.NaN },
        createdAt: hoursAgo(2),
      },
    ]);
    const m = await service.getMetrics();
    expect(m.day).toEqual({
      ticks: 2,
      sent: 0,
      transient: 0,
      waited: 0,
      deferred: 0,
    });
  });

  it('render на пустой базе — строка без нулей', async () => {
    const { service } = makeService([]);
    expect(await service.render()).toContain(
      'За неделю напоминаний из очереди не было.',
    );
  });
});
