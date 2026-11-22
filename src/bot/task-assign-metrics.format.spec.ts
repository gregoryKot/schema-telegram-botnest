import { formatTaskAssignMetrics } from './task-assign-metrics.format';

describe('formatTaskAssignMetrics', () => {
  it('пустая БД — человеческая строка, не 0/NaN/мусор', () => {
    const text = formatTaskAssignMetrics({
      tile30: 0,
      catalog30: 0,
      custom30: 0,
      guide30: 0,
      template30: 0,
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
      guide30: 0,
      template30: 0,
    });
    expect(text).toContain(
      'Назначено заданий: 7 (упражнения приложения — 4, из справочника — 3)',
    );
    expect(text).not.toMatch(/свой текст|Дать заданием|шаблон/);
  });

  it('«Дать заданием» и шаблон — отдельными источниками и в сумме', () => {
    const text = formatTaskAssignMetrics({
      tile30: 1,
      catalog30: 0,
      custom30: 2,
      guide30: 3,
      template30: 4,
    });
    expect(text).toContain(
      'Назначено заданий: 10 (упражнения приложения — 1, свой текст — 2, «Дать заданием» из справочника — 3, из шаблона — 4)',
    );
  });
});
