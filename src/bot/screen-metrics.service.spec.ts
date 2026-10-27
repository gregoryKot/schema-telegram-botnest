// Агрегат настройки экранов: маппинг bigint→number, разбивка открытий по
// экрану и скрытий по паре (экран, блок). Prisma мокается.
import { ScreenMetricsService } from './screen-metrics.service';
import { HOME_TILES } from '../analytics/home-events.constants';

describe('ScreenMetricsService.getMetrics', () => {
  const build = (
    opens: Array<{ screen: string | null; c: bigint }>,
    hidden: Array<{ screen: string | null; block: string | null; c: bigint }>,
    moves: Array<{ screen: string | null; c: bigint }> = [],
    synced: Array<{ c: bigint }> = [{ c: 0n }],
  ) => {
    const queryRaw = jest
      .fn()
      .mockResolvedValueOnce(opens)
      .mockResolvedValueOnce(hidden)
      .mockResolvedValueOnce(moves)
      .mockResolvedValueOnce(synced);
    const count = jest.fn().mockResolvedValue(0);
    const prisma = {
      $queryRaw: queryRaw,
      analyticsEvent: { count },
    } as never;
    return { service: new ScreenMetricsService(prisma), queryRaw, count };
  };

  it('собирает открытия по экрану и скрытия по (экран, блок)', async () => {
    const { service } = build(
      [
        { screen: 'profile', c: 12n },
        { screen: 'patterns', c: 3n },
      ],
      [
        { screen: 'profile', block: 'streak', c: 3n },
        { screen: 'profile', block: 'heatmap', c: 1n },
      ],
    );
    await expect(service.getMetrics()).resolves.toEqual({
      opensByScreen: [
        { screen: 'profile', count: 12 },
        { screen: 'patterns', count: 3 },
      ],
      hiddenByScreenBlock: [
        { screen: 'profile', block: 'streak', count: 3 },
        { screen: 'profile', block: 'heatmap', count: 1 },
      ],
      movesByScreen: [],
      syncedUsers: 0,
      homeTiles: HOME_TILES.map((tile) => ({ tile, count: 0 })),
      trackerSkips: 0,
    });
  });

  it('пустая БД даёт пустые списки, а не NaN/undefined', async () => {
    const { service } = build([], []);
    await expect(service.getMetrics()).resolves.toEqual({
      opensByScreen: [],
      hiddenByScreenBlock: [],
      movesByScreen: [],
      syncedUsers: 0,
      homeTiles: HOME_TILES.map((tile) => ({ tile, count: 0 })),
      trackerSkips: 0,
    });
  });

  it('строка с screen=null или block=null отбрасывается (не теряя типов)', async () => {
    const { service } = build(
      [{ screen: null, c: 5n }],
      [
        { screen: 'profile', block: null, c: 2n },
        { screen: null, block: 'streak', c: 1n },
      ],
    );
    await expect(service.getMetrics()).resolves.toEqual({
      opensByScreen: [],
      hiddenByScreenBlock: [],
      movesByScreen: [],
      syncedUsers: 0,
      homeTiles: HOME_TILES.map((tile) => ({ tile, count: 0 })),
      trackerSkips: 0,
    });
  });

  it('movesByScreen — группировка screen_block_move по экрану, bigint→number, null-экран отброшен', async () => {
    const { service } = build(
      [],
      [],
      [
        { screen: 'profile', c: 9n },
        { screen: 'today', c: 2n },
        { screen: null, c: 5n },
      ],
    );
    await expect(service.getMetrics()).resolves.toMatchObject({
      movesByScreen: [
        { screen: 'profile', count: 9 },
        { screen: 'today', count: 2 },
      ],
    });
  });

  it('syncedUsers — count(User where uiPrefs not null), приведённый к number', async () => {
    const { service } = build([], [], [], [{ c: 42n }]);
    await expect(service.getMetrics()).resolves.toMatchObject({
      syncedUsers: 42,
    });
  });

  it('render() отдаёт готовый текстовый блок для /stats', async () => {
    const { service } = build([{ screen: 'profile', c: 5n }], []);
    await expect(service.render()).resolves.toContain(
      'Профиль: открывали 5 раз',
    );
  });

  it('trackerSkips — счёт события tracker_skip за месяц без фильтра по meta', async () => {
    const { service, count } = build([], []);
    count.mockImplementation(({ where }: { where: { name: string } }) =>
      Promise.resolve(where.name === 'tracker_skip' ? 4 : 0),
    );
    const m = await service.getMetrics();
    expect(m.trackerSkips).toBe(4);
    expect(count).toHaveBeenCalledWith({
      where: { name: 'tracker_skip', createdAt: { gte: expect.any(Date) } },
    });
  });

  it('homeTiles — по счёту на каждую плитку из реестра, фильтр по JSON meta.tile', async () => {
    const { service, count } = build([], []);
    count.mockImplementation(
      ({ where }: { where: { meta?: { equals: string } } }) =>
        Promise.resolve(where.meta?.equals === 'diary' ? 7 : 0),
    );
    const m = await service.getMetrics();
    expect(m.homeTiles).toHaveLength(HOME_TILES.length);
    expect(m.homeTiles.find((t) => t.tile === 'diary')?.count).toBe(7);
    expect(count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        name: 'home_tile',
        meta: { path: ['tile'], equals: 'tracker' },
      }),
    });
  });
});
