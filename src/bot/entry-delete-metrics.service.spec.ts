// Агрегат удалений записей архива «Мой путь»: маппинг bigint→number,
// разбивка по типу, фильтрация null-типа (meta без type — не должно
// проползать в отчёт как отдельная строка). Prisma мокается.
import { EntryDeleteMetricsService } from './entry-delete-metrics.service';

describe('EntryDeleteMetricsService.getMetrics', () => {
  const build = (
    totalsRows: Array<Record<string, unknown>>,
    typeRows: Array<Record<string, unknown>> = [],
  ) => {
    const queryRaw = jest
      .fn()
      .mockResolvedValueOnce(totalsRows)
      .mockResolvedValueOnce(typeRows);
    const prisma = { $queryRaw: queryRaw } as never;
    return { service: new EntryDeleteMetricsService(prisma), queryRaw };
  };

  it('собирает счётчик удалений, людей и разбивку по типу', async () => {
    const { service } = build(
      [{ deleted: 12n, users: 6n }],
      [
        { type: 'belief_check', c: 7n },
        { type: 'letter', c: 3n },
      ],
    );
    await expect(service.getMetrics()).resolves.toEqual({
      deleted30: 12,
      users30: 6,
      byType30: [
        { type: 'belief_check', count: 7 },
        { type: 'letter', count: 3 },
      ],
    });
  });

  it('пустая БД даёт нули и пустую разбивку, а не NaN/undefined', async () => {
    const { service } = build([{ deleted: 0n, users: 0n }], []);
    await expect(service.getMetrics()).resolves.toEqual({
      deleted30: 0,
      users30: 0,
      byType30: [],
    });
  });

  it('пустой результат запроса (нет строк) — тоже нули', async () => {
    const { service } = build([], []);
    await expect(service.getMetrics()).resolves.toEqual({
      deleted30: 0,
      users30: 0,
      byType30: [],
    });
  });

  it('строка без type (null) в разбивке отфильтровывается', async () => {
    const { service } = build(
      [{ deleted: 5n, users: 2n }],
      [
        { type: 'letter', c: 4n },
        { type: null, c: 1n },
      ],
    );
    await expect(service.getMetrics()).resolves.toEqual({
      deleted30: 5,
      users30: 2,
      byType30: [{ type: 'letter', count: 4 }],
    });
  });

  it('render() отдаёт готовый текстовый блок для /stats', async () => {
    const { service, queryRaw } = build(
      [{ deleted: 9n, users: 4n }],
      [{ type: 'flashcard', c: 9n }],
    );
    queryRaw.mockResolvedValueOnce([{ deleted: 2n, users: 2n, completed: 1n }]);
    const text = await service.render();
    expect(text).toContain('Удалили записей: 9 · людей: 4');
    expect(text).toContain('Стёрли результаты теста схем: 2 раза · людей: 2');
  });
});

describe('EntryDeleteMetricsService.getYsq', () => {
  it('маппит bigint, пустой результат — нули', async () => {
    const queryRaw = jest
      .fn()
      .mockResolvedValueOnce([{ deleted: 3n, users: 2n, completed: 1n }])
      .mockResolvedValueOnce([]);
    const service = new EntryDeleteMetricsService({
      $queryRaw: queryRaw,
    } as never);
    await expect(service.getYsq()).resolves.toEqual({
      deleted30: 3,
      users30: 2,
      completedUsers30: 1,
    });
    await expect(service.getYsq()).resolves.toEqual({
      deleted30: 0,
      users30: 0,
      completedUsers30: 0,
    });
  });

  // Подделка через /api/event приходит без attempts (sanitizeMeta его режет).
  it('считает только строки ysq_data_deleted с attempts', async () => {
    const queryRaw = jest.fn().mockResolvedValueOnce([]);
    const service = new EntryDeleteMetricsService({
      $queryRaw: queryRaw,
    } as never);
    await service.getYsq();
    const sql = (queryRaw.mock.calls[0][0] as string[]).join('?');
    expect(sql).toContain(`"name" = 'ysq_data_deleted'`);
    expect(sql).toContain(`"meta"->>'attempts' IS NOT NULL`);
  });
});
