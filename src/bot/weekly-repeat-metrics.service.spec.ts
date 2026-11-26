import {
  getWeeklyRepeatMetrics,
  selfMapBlocks,
} from './weekly-repeat-metrics.service';

const run = (count: jest.Mock) =>
  getWeeklyRepeatMetrics({ analyticsEvent: { count } } as never);

describe('getWeeklyRepeatMetrics', () => {
  it('пустая БД — нули', async () => {
    const count = jest.fn().mockResolvedValue(0);
    expect(await run(count)).toEqual({
      total: 0,
      mode: 0,
      need: 0,
    });
  });

  it('считает режимы и потребности по meta.kind', async () => {
    const count = jest.fn(
      ({ where }: { where: { meta: { equals: string } } }) =>
        Promise.resolve(where.meta.equals === 'mode' ? 3 : 2),
    );
    expect(await run(count as never)).toEqual({
      total: 5,
      mode: 3,
      need: 2,
    });
  });
});

describe('selfMapBlocks', () => {
  it('склеивает переходы карты и «Повторы недели»', async () => {
    const out = await selfMapBlocks(
      {
        getSelfMapLinks: () =>
          Promise.resolve({
            mode: 0,
            schema: 0,
            patterns: 0,
            ysq_test: 0,
            map: 0,
          }),
      },
      { analyticsEvent: { count: jest.fn().mockResolvedValue(0) } } as never,
    );
    expect(out).toContain('Карта себя');
    expect(out).toContain('Повторы недели');
  });
});
