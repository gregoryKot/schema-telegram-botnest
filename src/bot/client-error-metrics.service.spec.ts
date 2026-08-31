// Агрегат поломок клиента: маппинг bigint→number и то, что запрос считает
// только серверные строки (userId IS NULL, name = 'client_error'). Prisma
// мокается — образец auth-health-metrics.service.spec.ts.
import { ClientErrorMetricsService } from './client-error-metrics.service';

describe('ClientErrorMetricsService.getMetrics', () => {
  const build = (rows: Array<Record<string, unknown>>) => {
    const queryRaw = jest.fn().mockResolvedValueOnce(rows);
    const prisma = { $queryRaw: queryRaw } as never;
    return { service: new ClientErrorMetricsService(prisma), queryRaw };
  };

  it('раскладывает счётчики по разделам и площадкам', async () => {
    const { service } = build([
      {
        total_day: 12n,
        total_week: 40n,
        auth_day: 5n,
        auth_week: 9n,
        login_week: 2n,
        today_week: 3n,
        diary_week: 8n,
        schemas_week: 0n,
        practice_week: 2n,
        profile_week: 1n,
        help_week: 0n,
        cabinet_week: 4n,
        other_week: 13n,
        webapp_week: 22n,
        miniapp_week: 18n,
      },
    ]);
    await expect(service.getMetrics()).resolves.toEqual({
      totalDay: 12,
      totalWeek: 40,
      authDay: 5,
      authWeek: 9,
      bySection: {
        login: 2,
        today: 3,
        diary: 8,
        schemas: 0,
        practice: 2,
        profile: 1,
        help: 0,
        cabinet: 4,
        other: 13,
      },
      bySource: { webapp: 22, miniapp: 18 },
    });
  });

  it('пустой результат — нули, а не NaN/undefined', async () => {
    const { service } = build([]);
    await expect(service.getMetrics()).resolves.toEqual({
      totalDay: 0,
      totalWeek: 0,
      authDay: 0,
      authWeek: 0,
      bySection: {
        login: 0,
        today: 0,
        diary: 0,
        schemas: 0,
        practice: 0,
        profile: 0,
        help: 0,
        cabinet: 0,
        other: 0,
      },
      bySource: { webapp: 0, miniapp: 0 },
    });
  });

  // Ключевой инвариант: /api/event открыт авторизованным клиентам, и без
  // фильтра по userId любой из них мог бы накрутить отчёт о поломках клиента
  // своим именем события (та же защита, что и у auth-health-metrics).
  it('считает только серверные строки — client_error с userId IS NULL', async () => {
    const { service, queryRaw } = build([
      {
        total_day: 0n,
        total_week: 0n,
        auth_day: 0n,
        auth_week: 0n,
        today_week: 0n,
        diary_week: 0n,
        schemas_week: 0n,
        practice_week: 0n,
        profile_week: 0n,
        help_week: 0n,
        cabinet_week: 0n,
        other_week: 0n,
        webapp_week: 0n,
        miniapp_week: 0n,
      },
    ]);
    await service.getMetrics();
    const sql = (
      queryRaw.mock.calls[0][0] as { join?: unknown } & string[]
    ).join('?');
    expect(sql).toContain(`"name" = 'client_error'`);
    expect(sql).toContain('"userId" IS NULL');
  });
});
