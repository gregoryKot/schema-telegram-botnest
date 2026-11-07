import { countEventsByKey } from './event-counts';

describe('countEventsByKey', () => {
  it('один count на поле, в окне; результат — по ключам таблицы', async () => {
    const since = { gte: new Date('2026-10-08T12:00:00.000Z') };
    const count = jest.fn(({ where }: { where: { name: string } }) =>
      Promise.resolve(where.name === 'cabinet_guide_open' ? 3 : 0),
    );
    const prisma = { analyticsEvent: { count } };
    await expect(
      countEventsByKey(
        prisma as never,
        [
          ['opens', 'cabinet_guide_open'],
          ['notes', 'cabinet_guide_note_open'],
        ],
        since,
      ),
    ).resolves.toEqual({ opens: 3, notes: 0 });
    expect(count).toHaveBeenCalledTimes(2);
    expect(count).toHaveBeenCalledWith({
      where: { name: 'cabinet_guide_note_open', createdAt: since },
    });
  });
});
