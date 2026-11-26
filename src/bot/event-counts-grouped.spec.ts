import { countEventsGrouped } from './event-counts-grouped';

describe('countEventsGrouped', () => {
  it('один запрос на всю таблицу; события без строк — ноль', async () => {
    const since = { gte: new Date('2026-10-08T12:00:00.000Z') };
    const groupBy = jest.fn(() =>
      Promise.resolve([{ name: 'cabinet_guide_open', _count: { _all: 3 } }]),
    );
    const prisma = { analyticsEvent: { groupBy } };
    await expect(
      countEventsGrouped(
        prisma as never,
        [
          ['opens', 'cabinet_guide_open'],
          ['needs', 'cabinet_guide_need_open'],
        ],
        since,
      ),
    ).resolves.toEqual({ opens: 3, needs: 0 });
    expect(groupBy).toHaveBeenCalledTimes(1);
    expect(groupBy).toHaveBeenCalledWith({
      by: ['name'],
      where: {
        name: { in: ['cabinet_guide_open', 'cabinet_guide_need_open'] },
        createdAt: since,
      },
      _count: { _all: true },
    });
  });
});
