// Агрегат отказов входа: маппинг bigint→number и то, что запрос считает
// только серверные строки. Prisma мокается (образец —
// account-link-metrics.service.spec.ts).
import { AuthHealthMetricsService } from './auth-health-metrics.service';

describe('AuthHealthMetricsService.getMetrics', () => {
  const build = (rows: Array<Record<string, unknown>>) => {
    const queryRaw = jest.fn().mockResolvedValueOnce(rows);
    const prisma = { $queryRaw: queryRaw } as never;
    return { service: new AuthHealthMetricsService(prisma), queryRaw };
  };

  it('раскладывает счётчики по площадкам и окнам', async () => {
    const { service } = build([
      { tg_day: 12n, max_day: 0n, tg_week: 300n, max_week: 4n },
    ]);
    await expect(service.getMetrics()).resolves.toEqual({
      day: { telegram: 12, max: 0 },
      week: { telegram: 300, max: 4 },
    });
  });

  it('пустой результат — нули, а не NaN/undefined', async () => {
    const { service } = build([]);
    await expect(service.getMetrics()).resolves.toEqual({
      day: { telegram: 0, max: 0 },
      week: { telegram: 0, max: 0 },
    });
  });

  // Ключевой инвариант: /api/event открыт авторизованным клиентам, и без
  // фильтра по userId любой из них мог бы накрутить отчёт о здоровье входа.
  it('считает только серверные строки — auth_rejected с userId IS NULL', async () => {
    const { service, queryRaw } = build([
      { tg_day: 0n, max_day: 0n, tg_week: 0n, max_week: 0n },
    ]);
    await service.getMetrics();
    const sql = (
      queryRaw.mock.calls[0][0] as { join?: unknown } & string[]
    ).join('?');
    expect(sql).toContain(`"name" = 'auth_rejected'`);
    expect(sql).toContain('"userId" IS NULL');
  });
});
