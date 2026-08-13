// Агрегат атрибуции посевов: раскладка bigint→number по allow-list источников
// и сворачивание неизвестного src в 'other'. Prisma мокается.
import { SignupSourceMetricsService } from './signup-source-metrics.service';

describe('SignupSourceMetricsService.getMetrics', () => {
  const build = (rows: Array<Record<string, unknown>>) => {
    const queryRaw = jest.fn().mockResolvedValueOnce(rows);
    const prisma = { $queryRaw: queryRaw } as never;
    return { service: new SignupSourceMetricsService(prisma), queryRaw };
  };

  it('раскладывает счётчики по известным источникам', async () => {
    const { service } = build([
      { src: 'seed1', c7: 3n, c30: 10n },
      { src: 'channel', c7: 1n, c30: 2n },
    ]);
    const m = await service.getMetrics();
    expect(m.total7).toBe(4);
    expect(m.total30).toBe(12);
    expect(m.bySource).toContainEqual({ src: 'seed1', count7: 3, count30: 10 });
    expect(m.bySource).toContainEqual({
      src: 'channel',
      count7: 1,
      count30: 2,
    });
    expect(m.bySource).toContainEqual({ src: 'seed2', count7: 0, count30: 0 });
  });

  it('пустой результат запроса — все источники нули, тотал 0', async () => {
    const { service } = build([]);
    const m = await service.getMetrics();
    expect(m.total7).toBe(0);
    expect(m.total30).toBe(0);
    for (const b of m.bySource) {
      expect(b.count7).toBe(0);
      expect(b.count30).toBe(0);
    }
  });

  it('src вне allow-list (рассинхрон/историческая запись) — сворачивается в other, не теряется', async () => {
    const { service } = build([
      { src: 'какой-то-старый-slug', c7: 1n, c30: 5n },
      { src: 'other', c7: 0n, c30: 1n },
    ]);
    const m = await service.getMetrics();
    const other = m.bySource.find((b) => b.src === 'other')!;
    expect(other.count7).toBe(1);
    expect(other.count30).toBe(6);
    expect(m.total30).toBe(6);
  });

  it('src = null (историческая запись без meta) — тоже сворачивается в other', async () => {
    const { service } = build([{ src: null, c7: 2n, c30: 2n }]);
    const m = await service.getMetrics();
    const other = m.bySource.find((b) => b.src === 'other')!;
    expect(other.count30).toBe(2);
  });

  it('ходит в БД один раз', async () => {
    const { service, queryRaw } = build([{ src: 'seed1', c7: 1n, c30: 1n }]);
    await service.getMetrics();
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('в запросе фильтрует ровно событие signup_source', async () => {
    const { service, queryRaw } = build([{ src: 'seed1', c7: 1n, c30: 1n }]);
    await service.getMetrics();
    const sql = (
      queryRaw.mock.calls[0][0] as { join?: unknown } & string[]
    ).join('');
    expect(sql).toContain('signup_source');
  });

  it('render() отдаёт готовый текстовый блок для /stats', async () => {
    const { service } = build([{ src: 'seed1', c7: 1n, c30: 3n }]);
    await expect(service.render()).resolves.toContain('Посев №1: 3 за месяц');
  });
});
