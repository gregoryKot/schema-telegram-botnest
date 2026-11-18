import { formatTaskAssignMetrics } from './task-assign-metrics.format';

describe('formatTaskAssignMetrics', () => {
  it('пустая БД — человеческая строка, не 0/NaN/мусор', () => {
    const text = formatTaskAssignMetrics({
      tile30: 0,
      catalog30: 0,
      custom30: 0,
    });
    expect(text).toContain('📌 <b>Задания клиентам</b> (за месяц)');
    expect(text).toContain('Пока никто из терапевтов не назначал задания.');
    expect(text).not.toMatch(/NaN|undefined|— 0|: 0/);
  });

  it('сумма и разбивка по источникам, нулевой источник не показывается', () => {
    const text = formatTaskAssignMetrics({
      tile30: 4,
      catalog30: 3,
      custom30: 0,
    });
    expect(text).toContain(
      'Назначено заданий: 7 (упражнения приложения — 4, из справочника — 3)',
    );
    expect(text).not.toContain('свой текст');
  });
});
