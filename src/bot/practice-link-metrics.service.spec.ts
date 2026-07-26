// Агрегат переходов на сайт практики: маппинг bigint→number, разбивка по
// meta.place, неизвестные места не выпадают из итога. Prisma мокается.
import { PracticeLinkMetricsService } from './practice-link-metrics.service';

describe('PracticeLinkMetricsService.getMetrics', () => {
  const build = (rows: Array<{ place: string | null; c: bigint }>) => {
    const queryRaw = jest.fn().mockResolvedValueOnce(rows);
    const prisma = { $queryRaw: queryRaw } as never;
    return { service: new PracticeLinkMetricsService(prisma), queryRaw };
  };

  it('собирает итог и разбивку по местам клика', async () => {
    const { service } = build([
      { place: 'author', c: 5n },
      { place: 'footer', c: 2n },
      { place: 'faq', c: 1n },
    ]);
    await expect(service.getMetrics()).resolves.toEqual({
      total30: 8,
      author30: 5,
      footer30: 2,
      faq30: 1,
    });
  });

  it('пустая БД даёт нули, а не NaN/undefined', async () => {
    const { service } = build([]);
    await expect(service.getMetrics()).resolves.toEqual({
      total30: 0,
      author30: 0,
      footer30: 0,
      faq30: 0,
    });
  });

  it('неизвестное место клика считается в итоге (не теряем переходы)', async () => {
    const { service } = build([
      { place: 'author', c: 3n },
      { place: null, c: 2n },
    ]);
    await expect(service.getMetrics()).resolves.toEqual({
      total30: 5,
      author30: 3,
      footer30: 0,
      faq30: 0,
    });
  });
});
