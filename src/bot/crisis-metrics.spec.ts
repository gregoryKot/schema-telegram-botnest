// Показы кризисной карточки в /stats: всего и отдельно из формы записи
// (аудит 2026-10, frontends#5). Запрос — через Prisma (JSON path по
// meta.surface); как JSON-фильтр исполняется на живом Postgres, проверяет
// test/raw-sql-live-stats.e2e-spec.ts (мок этого не доказывает).
import { countCrisis } from './crisis-metrics';

describe('countCrisis', () => {
  const since = new Date('2026-09-01T00:00:00Z');

  it('считает всего и по surface=booking: четыре запроса с нужным фильтром', async () => {
    const count = jest
      .fn()
      .mockResolvedValueOnce(12)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(2);
    const res = await countCrisis(
      { analyticsEvent: { count } } as never,
      since,
    );
    expect(res).toEqual({
      shown: 12,
      hotlineTapped: 3,
      booking: { shown: 5, hotlineTapped: 2 },
    });
    const surfaceFilter = { meta: { path: ['surface'], equals: 'booking' } };
    expect(count.mock.calls.map((c) => c[0].where)).toEqual([
      { name: 'crisis_card_shown', createdAt: { gte: since } },
      { name: 'crisis_hotline_tapped', createdAt: { gte: since } },
      {
        name: 'crisis_card_shown',
        createdAt: { gte: since },
        ...surfaceFilter,
      },
      {
        name: 'crisis_hotline_tapped',
        createdAt: { gte: since },
        ...surfaceFilter,
      },
    ]);
  });

  it('пустая таблица — нули, не undefined', async () => {
    const count = jest.fn().mockResolvedValue(0);
    const res = await countCrisis(
      { analyticsEvent: { count } } as never,
      since,
    );
    expect(res).toEqual({
      shown: 0,
      hotlineTapped: 0,
      booking: { shown: 0, hotlineTapped: 0 },
    });
  });
});
