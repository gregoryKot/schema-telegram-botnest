// Агрегат события data_export: маппинг bigint→number и пересчёт даты
// последней выгрузки в «сколько дней назад». Prisma мокается (образец —
// signup-source-metrics.service.spec.ts).
import { DataExportMetricsService } from './data-export-metrics.service';

describe('DataExportMetricsService.getMetrics', () => {
  const build = (rows: Array<Record<string, unknown>>) => {
    const queryRaw = jest.fn().mockResolvedValueOnce(rows);
    const prisma = { $queryRaw: queryRaw } as never;
    return { service: new DataExportMetricsService(prisma), queryRaw };
  };

  it('раскладывает счётчики за всё время и за 30 дней', async () => {
    const { service } = build([
      {
        total: 7n,
        total_users: 5n,
        c30: 3n,
        users30: 2n,
        last_at: new Date(),
      },
    ]);
    const m = await service.getMetrics();
    expect(m.totalExports).toBe(7);
    expect(m.totalUsers).toBe(5);
    expect(m.exports30).toBe(3);
    expect(m.users30).toBe(2);
    expect(m.daysSinceLast).toBe(0);
  });

  it('пустой результат запроса — все нули, а не NaN/undefined', async () => {
    const { service } = build([]);
    await expect(service.getMetrics()).resolves.toEqual({
      totalExports: 0,
      totalUsers: 0,
      exports30: 0,
      users30: 0,
      daysSinceLast: 0,
    });
  });

  it('last_at = null (ни одной выгрузки) — daysSinceLast 0, не NaN', async () => {
    const { service } = build([
      { total: 0n, total_users: 0n, c30: 0n, users30: 0n, last_at: null },
    ]);
    const m = await service.getMetrics();
    expect(m.daysSinceLast).toBe(0);
    expect(Number.isNaN(m.daysSinceLast)).toBe(false);
  });

  it('считает дни с последней выгрузки по last_at', async () => {
    const fourDaysAgo = new Date(Date.now() - 4 * 86_400_000 - 1000);
    const { service } = build([
      {
        total: 1n,
        total_users: 1n,
        c30: 1n,
        users30: 1n,
        last_at: fourDaysAgo,
      },
    ]);
    const m = await service.getMetrics();
    expect(m.daysSinceLast).toBe(4);
  });

  it('в запросе фильтрует ровно событие data_export', async () => {
    const { service, queryRaw } = build([
      { total: 1n, total_users: 1n, c30: 1n, users30: 1n, last_at: null },
    ]);
    await service.getMetrics();
    const sql = (
      queryRaw.mock.calls[0][0] as { join?: unknown } & string[]
    ).join('');
    expect(sql).toContain(`'data_export'`);
  });

  it('render() отдаёт готовый текстовый блок для /stats', async () => {
    const { service } = build([
      {
        total: 7n,
        total_users: 5n,
        c30: 3n,
        users30: 2n,
        last_at: new Date(),
      },
    ]);
    await expect(service.render()).resolves.toContain(
      'Всего забирали данные 7 раз',
    );
  });
});
