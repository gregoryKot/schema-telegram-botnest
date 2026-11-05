// Агрегат меню «плюс»: маппинг bigint→number, разбивка по meta.action для
// скрытых пунктов. Prisma мокается.
import { PlusMetricsService } from './plus-metrics.service';

describe('PlusMetricsService.getMetrics', () => {
  const build = (
    hidden: Array<{ action: string | null; c: bigint }>,
    moves: Array<{ moves: bigint }> = [{ moves: 0n }],
  ) => {
    const queryRaw = jest
      .fn()
      .mockResolvedValueOnce(hidden)
      .mockResolvedValueOnce(moves);
    const prisma = { $queryRaw: queryRaw } as never;
    return { service: new PlusMetricsService(prisma), queryRaw };
  };

  it('собирает, что прячут, и сколько переставляли', async () => {
    const { service } = build([{ action: 'plans', c: 2n }], [{ moves: 7n }]);
    await expect(service.getMetrics()).resolves.toEqual({
      hidden30: [{ action: 'plans', count: 2 }],
      moves30: 7,
    });
  });

  it('пустая БД даёт нули и пустые списки, а не NaN/undefined', async () => {
    const { service } = build([]);
    await expect(service.getMetrics()).resolves.toEqual({
      hidden30: [],
      moves30: 0,
    });
  });

  it('пустой результат запроса перестановок (нет строк) — тоже ноль', async () => {
    const { service } = build([], []);
    await expect(service.getMetrics()).resolves.toEqual({
      hidden30: [],
      moves30: 0,
    });
  });

  it('строка с action=null отбрасывается из разбивки (не теряя типов)', async () => {
    const { service } = build([{ action: null, c: 5n }]);
    await expect(service.getMetrics()).resolves.toEqual({
      hidden30: [],
      moves30: 0,
    });
  });

  it('render() отдаёт готовый текстовый блок для /stats', async () => {
    const { service } = build([{ action: 'tracker', c: 5n }]);
    await expect(service.render()).resolves.toContain(
      'Убирают из меню: Трекер потребностей — 5',
    );
  });
});
