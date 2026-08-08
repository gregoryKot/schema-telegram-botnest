// Агрегат настройки экранов: маппинг bigint→number, разбивка открытий по
// экрану и скрытий по паре (экран, блок). Prisma мокается.
import { ScreenMetricsService } from './screen-metrics.service';

describe('ScreenMetricsService.getMetrics', () => {
  const build = (
    opens: Array<{ screen: string | null; c: bigint }>,
    hidden: Array<{ screen: string | null; block: string | null; c: bigint }>,
    moves: Array<{ moves: bigint }> = [{ moves: 0n }],
    synced: Array<{ c: bigint }> = [{ c: 0n }],
  ) => {
    const queryRaw = jest
      .fn()
      .mockResolvedValueOnce(opens)
      .mockResolvedValueOnce(hidden)
      .mockResolvedValueOnce(moves)
      .mockResolvedValueOnce(synced);
    const prisma = { $queryRaw: queryRaw } as never;
    return { service: new ScreenMetricsService(prisma), queryRaw };
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
      moves30: 0,
      syncedUsers: 0,
    });
  });

  it('пустая БД даёт пустые списки, а не NaN/undefined', async () => {
    const { service } = build([], []);
    await expect(service.getMetrics()).resolves.toEqual({
      opensByScreen: [],
      hiddenByScreenBlock: [],
      moves30: 0,
      syncedUsers: 0,
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
      moves30: 0,
      syncedUsers: 0,
    });
  });

  it('moves30 — count(screen_block_move за 30 дней), приведённый к number', async () => {
    const { service } = build([], [], [{ moves: 9n }]);
    await expect(service.getMetrics()).resolves.toMatchObject({
      moves30: 9,
    });
  });

  it('syncedUsers — count(User where uiPrefs not null), приведённый к number', async () => {
    const { service } = build([], [], [{ moves: 0n }], [{ c: 42n }]);
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
});
