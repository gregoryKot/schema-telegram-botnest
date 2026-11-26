import { cronGapsMs } from './cron-gap';

describe('cronGapsMs — равномерные расписания: min === max === период', () => {
  it.each([
    ['* * * * *', 60_000],
    ['*/5 * * * *', 5 * 60_000],
    ['*/15 * * * *', 15 * 60_000],
    ['7 * * * *', 3_600_000],
    ['0 0 * * *', 24 * 3_600_000],
    ['17 3 * * *', 24 * 3_600_000],
  ])('%s → %dмс', (expr, expected) => {
    const { minGapMs, maxGapMs } = cronGapsMs(expr);
    expect(minGapMs).toBe(expected);
    expect(maxGapMs).toBe(expected);
  });
});

describe('cronGapsMs — оконные расписания: min — шаг внутри окна, max — молчание между окнами', () => {
  it.each([['*/5 9,10 * * *'], ['*/5 18,19 * * *']])(
    '%s → min 5 мин, max 22ч05м',
    (expr) => {
      const { minGapMs, maxGapMs } = cronGapsMs(expr);
      expect(minGapMs).toBe(5 * 60_000);
      expect(maxGapMs).toBe(22 * 3_600_000 + 5 * 60_000);
    },
  );
});

describe('cronGapsMs — списки и диапазоны в поле минут', () => {
  it('0,30 * * * * → каждые 30 минут весь день', () => {
    expect(cronGapsMs('0,30 * * * *')).toEqual({
      minGapMs: 30 * 60_000,
      maxGapMs: 30 * 60_000,
    });
  });

  it('0-10/5 8 * * * → три тика внутри часа 8:00–8:10, молчание до следующего дня', () => {
    expect(cronGapsMs('0-10/5 8 * * *')).toEqual({
      minGapMs: 5 * 60_000,
      maxGapMs: 1430 * 60_000, // 23ч50м — от 8:10 до 8:00 следующих суток
    });
  });
});

describe('cronGapsMs — расписание реже суточного (день-месяца/месяц/день-недели не «*»)', () => {
  it('возвращает консервативный maxGapMs = 7 суток; minGapMs считает как обычно', () => {
    const { minGapMs, maxGapMs } = cronGapsMs('0 9 1 * *');
    expect(minGapMs).toBe(24 * 3_600_000);
    expect(maxGapMs).toBe(7 * 24 * 3_600_000);
  });
});

describe('cronGapsMs — непарсящееся выражение бросает, а не молчит', () => {
  it.each([
    ['* * * *', 'не 5 полей'],
    ['60 * * * *', 'минута вне диапазона 0-59'],
    ['* 24 * * *', 'час вне диапазона 0-23'],
    ['foo * * * *', 'не число и не *'],
    ['*/0 * * * *', 'нулевой шаг'],
  ])('%s (%s)', (expr) => {
    expect(() => cronGapsMs(expr)).toThrow();
  });
});
