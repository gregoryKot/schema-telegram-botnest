import {
  EMPTY_WEEKLY_REPEAT_METRICS,
  formatWeeklyRepeatMetrics,
} from './weekly-repeat-metrics.format';

describe('formatWeeklyRepeatMetrics', () => {
  it('пустая БД — без NaN и undefined', () => {
    const out = formatWeeklyRepeatMetrics(EMPTY_WEEKLY_REPEAT_METRICS);
    expect(out).toContain('Пока ничего не поставлено в очередь');
    expect(out).not.toMatch(/NaN|undefined/);
  });

  it('считает по видам', () => {
    expect(formatWeeklyRepeatMetrics({ total: 5, mode: 3, need: 2 })).toContain(
      'Поставлено в очередь 5 (режимы 3, потребности 2)',
    );
  });
});
