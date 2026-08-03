// Агрегат открытий «Тёплых слов»: маппинг bigint→number. Prisma мокается.
import { WarmWordsMetricsService } from './warm-words-metrics.service';

describe('WarmWordsMetricsService.getMetrics', () => {
  const build = (rows: Array<Record<string, unknown>>) => {
    const queryRaw = jest.fn().mockResolvedValueOnce(rows);
    const prisma = { $queryRaw: queryRaw } as never;
    return { service: new WarmWordsMetricsService(prisma), queryRaw };
  };

  it('собирает счётчик открытий и людей', async () => {
    const { service } = build([{ opens: 23n, users: 9n }]);
    await expect(service.getMetrics()).resolves.toEqual({
      opens30: 23,
      users30: 9,
    });
  });

  it('пустая БД даёт нули, а не NaN/undefined', async () => {
    const { service } = build([{ opens: 0n, users: 0n }]);
    await expect(service.getMetrics()).resolves.toEqual({
      opens30: 0,
      users30: 0,
    });
  });

  it('пустой результат запроса (нет строк) — тоже нули', async () => {
    const { service } = build([]);
    await expect(service.getMetrics()).resolves.toEqual({
      opens30: 0,
      users30: 0,
    });
  });

  it('render() отдаёт готовый текстовый блок для /stats', async () => {
    const { service } = build([{ opens: 5n, users: 3n }]);
    await expect(service.render()).resolves.toContain(
      'Открывали свои тёплые слова: 5 раз (3 человек)',
    );
  });
});
