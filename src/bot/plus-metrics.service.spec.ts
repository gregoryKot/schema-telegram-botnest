// Агрегат меню «плюс»: маппинг bigint→number, разбивка по meta.action для
// выбранных и скрытых пунктов. Prisma мокается.
import { PlusMetricsService } from './plus-metrics.service';

describe('PlusMetricsService.getMetrics', () => {
  const build = (
    opens: Array<{ opens: bigint; users: bigint }>,
    actions: Array<{ action: string | null; c: bigint }>,
    hidden: Array<{ action: string | null; c: bigint }>,
  ) => {
    const queryRaw = jest
      .fn()
      .mockResolvedValueOnce(opens)
      .mockResolvedValueOnce(actions)
      .mockResolvedValueOnce(hidden);
    const prisma = { $queryRaw: queryRaw } as never;
    return { service: new PlusMetricsService(prisma), queryRaw };
  };

  it('собирает открытия, топ действий и что прячут', async () => {
    const { service } = build(
      [{ opens: 40n, users: 12n }],
      [
        { action: 'tracker', c: 15n },
        { action: 'breathing', c: 9n },
      ],
      [{ action: 'plans', c: 2n }],
    );
    await expect(service.getMetrics()).resolves.toEqual({
      opens30: 40,
      users30: 12,
      actions30: [
        { action: 'tracker', count: 15 },
        { action: 'breathing', count: 9 },
      ],
      hidden30: [{ action: 'plans', count: 2 }],
    });
  });

  it('пустая БД даёт нули и пустые списки, а не NaN/undefined', async () => {
    const { service } = build([{ opens: 0n, users: 0n }], [], []);
    await expect(service.getMetrics()).resolves.toEqual({
      opens30: 0,
      users30: 0,
      actions30: [],
      hidden30: [],
    });
  });

  it('пустой результат первого запроса (нет строк) — тоже нули', async () => {
    const { service } = build([], [], []);
    await expect(service.getMetrics()).resolves.toEqual({
      opens30: 0,
      users30: 0,
      actions30: [],
      hidden30: [],
    });
  });

  it('строка с action=null отбрасывается из разбивки (не теряя типов)', async () => {
    const { service } = build(
      [{ opens: 5n, users: 3n }],
      [{ action: null, c: 5n }],
      [],
    );
    await expect(service.getMetrics()).resolves.toEqual({
      opens30: 5,
      users30: 3,
      actions30: [],
      hidden30: [],
    });
  });

  it('render() отдаёт готовый текстовый блок для /stats', async () => {
    const { service } = build(
      [{ opens: 5n, users: 3n }],
      [{ action: 'tracker', c: 5n }],
      [],
    );
    await expect(service.render()).resolves.toContain(
      'Открывали: 5 раз (3 человек)',
    );
  });
});
