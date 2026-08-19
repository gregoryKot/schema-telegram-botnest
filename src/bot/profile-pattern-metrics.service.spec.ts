// Агрегат открытий листа схемы/режима со вкладки «Я»: группировка по
// meta.kind, маппинг bigint→number. Prisma мокается.
import { ProfilePatternMetricsService } from './profile-pattern-metrics.service';

describe('ProfilePatternMetricsService.getMetrics', () => {
  const build = (rows: Array<Record<string, unknown>>) => {
    const queryRaw = jest.fn().mockResolvedValueOnce(rows);
    const prisma = { $queryRaw: queryRaw } as never;
    return { service: new ProfilePatternMetricsService(prisma), queryRaw };
  };

  it('собирает раздельные счётчики схем и режимов', async () => {
    const { service } = build([
      { kind: 'schema', c: 12n },
      { kind: 'mode', c: 7n },
    ]);
    await expect(service.getMetrics()).resolves.toEqual({
      schemaOpens30: 12,
      modeOpens30: 7,
    });
  });

  it('пустой результат запроса (нет строк) — нули, а не NaN/undefined', async () => {
    const { service } = build([]);
    await expect(service.getMetrics()).resolves.toEqual({
      schemaOpens30: 0,
      modeOpens30: 0,
    });
  });

  it('render() отдаёт готовый текстовый блок для /stats', async () => {
    const { service } = build([{ kind: 'schema', c: 3n }]);
    await expect(service.render()).resolves.toContain(
      'открывали схемы 3 раз, режимы 0 раз',
    );
  });
});
