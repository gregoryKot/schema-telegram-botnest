// Агрегат страницы ссылок: разбивка по meta.target и meta.from, строка с
// неизвестной meta остаётся в итоге. Prisma мокается.
import { LinksPageMetricsService } from './links-page-metrics.service';

const build = (rows: Array<{ meta: unknown }>) => {
  const findMany = jest.fn().mockResolvedValue(rows);
  const prisma = { analyticsEvent: { findMany } } as never;
  return { service: new LinksPageMetricsService(prisma), findMany };
};

describe('LinksPageMetricsService.getMetrics', () => {
  it('считает нажатия по кнопкам и источникам за 30 дней', async () => {
    const { service, findMany } = build([
      { meta: { target: 'booking', from: 'telegram' } },
      { meta: { target: 'booking', from: 'direct' } },
      { meta: { target: 'project', from: 'telegram' } },
      { meta: null },
    ]);
    const m = await service.getMetrics();
    expect(m.total30).toBe(4);
    expect(m.byTarget).toMatchObject({ booking: 2, project: 1, write: 0 });
    expect(m.byFrom).toMatchObject({ telegram: 2, direct: 1, other: 0 });
    const where = findMany.mock.calls[0][0].where;
    expect(where.name).toBe('links_page_click');
    expect(Date.now() - where.createdAt.gte.getTime()).toBeLessThan(
      30 * 86_400_000 + 5_000,
    );
  });

  it('пустая БД даёт нули', async () => {
    const m = await build([]).service.getMetrics();
    expect(m.total30).toBe(0);
    expect(Object.values(m.byTarget).every((n) => n === 0)).toBe(true);
    expect(Object.values(m.byFrom).every((n) => n === 0)).toBe(true);
  });
});
