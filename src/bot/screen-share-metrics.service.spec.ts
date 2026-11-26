import { ScreenShareMetricsService } from './screen-share-metrics.service';

const NOW = new Date('2026-10-15T12:00:00.000Z');
const SINCE = new Date(NOW.getTime() - 30 * 86_400_000);

function makeService(opts: {
  on?: number;
  groups?: Array<{ userId: bigint | null }>;
}) {
  const count = jest.fn(() => Promise.resolve(opts.on ?? 0));
  const groupBy = jest.fn(() => Promise.resolve(opts.groups ?? []));
  const prisma = { analyticsEvent: { count, groupBy } };
  return {
    service: new ScreenShareMetricsService(prisma as never),
    count,
    groupBy,
  };
}

describe('ScreenShareMetricsService', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
  });
  afterEach(() => jest.useRealTimers());

  it('считает включения и разных терапевтов за 30 дней', async () => {
    const { service } = makeService({
      on: 5,
      groups: [{ userId: 1n }, { userId: 2n }],
    });
    await expect(service.getMetrics()).resolves.toEqual({
      on30: 5,
      therapists30: 2,
    });
  });

  it('спрашивает нужное событие и окно createdAt >= 30 дней назад', async () => {
    const { service, count, groupBy } = makeService({});
    await service.getMetrics();
    expect(count).toHaveBeenCalledWith({
      where: { name: 'cabinet_screen_share_on', createdAt: { gte: SINCE } },
    });
    expect(groupBy).toHaveBeenCalledWith({
      by: ['userId'],
      where: {
        name: 'cabinet_screen_share_on',
        createdAt: { gte: SINCE },
        userId: { not: null },
      },
    });
  });

  it('пустая БД — человеческая строка в render()', async () => {
    const { service } = makeService({});
    const text = await service.render();
    expect(text).toContain(
      'Пока никто из терапевтов не прятал список клиентов',
    );
  });

  it('render() с данными', async () => {
    const { service } = makeService({ on: 2, groups: [{ userId: 9n }] });
    await expect(service.render()).resolves.toContain(
      'экрана 2 раз, терапевтов: 1',
    );
  });
});
