// Агрегат дневника режимов: маппинг bigint→number по двум запросам
// (mode_entry_saved и mode_test_completed). Prisma мокается.
import { ModeDiaryMetricsService } from './mode-diary-metrics.service';

describe('ModeDiaryMetricsService.getMetrics', () => {
  const build = (
    entryRows: Array<Record<string, unknown>>,
    testRows: Array<Record<string, unknown>>,
  ) => {
    const queryRaw = jest
      .fn()
      .mockResolvedValueOnce(entryRows)
      .mockResolvedValueOnce(testRows);
    const prisma = { $queryRaw: queryRaw } as never;
    return { service: new ModeDiaryMetricsService(prisma), queryRaw };
  };

  it('собирает записи, ответы Здорового Взрослого и тест', async () => {
    const { service } = build(
      [{ saves7: 5n, saves30: 20n, withHealthy30: 12n }],
      [{ testCompleted7: 3n, testCompleted30: 9n }],
    );
    await expect(service.getMetrics()).resolves.toEqual({
      saves7: 5,
      saves30: 20,
      withHealthy30: 12,
      testCompleted7: 3,
      testCompleted30: 9,
    });
  });

  it('пустая БД даёт нули, а не NaN/undefined', async () => {
    const { service } = build(
      [{ saves7: 0n, saves30: 0n, withHealthy30: 0n }],
      [{ testCompleted7: 0n, testCompleted30: 0n }],
    );
    await expect(service.getMetrics()).resolves.toEqual({
      saves7: 0,
      saves30: 0,
      withHealthy30: 0,
      testCompleted7: 0,
      testCompleted30: 0,
    });
  });

  it('пустой результат запроса (нет строк) — тоже нули', async () => {
    const { service } = build([], []);
    await expect(service.getMetrics()).resolves.toEqual({
      saves7: 0,
      saves30: 0,
      withHealthy30: 0,
      testCompleted7: 0,
      testCompleted30: 0,
    });
  });

  it('render() отдаёт готовый текстовый блок для /stats', async () => {
    const { service } = build(
      [{ saves7: 1n, saves30: 4n, withHealthy30: 2n }],
      [{ testCompleted7: 0n, testCompleted30: 0n }],
    );
    await expect(service.render()).resolves.toContain(
      'Записей за неделю: 1 · за месяц: 4',
    );
  });
});
