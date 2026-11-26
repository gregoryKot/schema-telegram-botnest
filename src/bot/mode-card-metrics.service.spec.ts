// Агрегат сохранений карточки режима: маппинг bigint→number, среднее число
// заполненных полей. Prisma мокается.
import { ModeCardMetricsService } from './mode-card-metrics.service';

describe('ModeCardMetricsService.getMetrics', () => {
  const build = (rows: Array<Record<string, unknown>>) => {
    const queryRaw = jest.fn().mockResolvedValueOnce(rows);
    const prisma = { $queryRaw: queryRaw } as never;
    return { service: new ModeCardMetricsService(prisma), queryRaw };
  };

  it('собирает счётчик сохранений, людей и среднее число полей', async () => {
    const { service } = build([{ saved: 42n, users: 17n, avgFilled: 4.5 }]);
    await expect(service.getMetrics()).resolves.toEqual({
      saved30: 42,
      users30: 17,
      avgFilled30: 4.5,
    });
  });

  it('пустая БД даёт нули, а не NaN/undefined', async () => {
    const { service } = build([{ saved: 0n, users: 0n, avgFilled: null }]);
    await expect(service.getMetrics()).resolves.toEqual({
      saved30: 0,
      users30: 0,
      avgFilled30: 0,
    });
  });

  it('пустой результат запроса (нет строк) — тоже нули', async () => {
    const { service } = build([]);
    await expect(service.getMetrics()).resolves.toEqual({
      saved30: 0,
      users30: 0,
      avgFilled30: 0,
    });
  });

  it('render() отдаёт готовый текстовый блок для /stats', async () => {
    const { service } = build([{ saved: 9n, users: 4n, avgFilled: 3.5 }]);
    await expect(service.render()).resolves.toContain(
      'Карточек режимов заполнено: 9 (у 4 человек)',
    );
  });
});
