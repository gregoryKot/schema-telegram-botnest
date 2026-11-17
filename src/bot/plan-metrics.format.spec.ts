import { formatPlanMetrics } from './plan-metrics.format';
import type { PlanMetrics } from './plan-metrics.types';

const EMPTY: PlanMetrics = {
  added30: 0,
  fromGuide30: 0,
  therapists30: 0,
  active30: 0,
  done30: 0,
};

describe('formatPlanMetrics', () => {
  it('пустая БД — человеческая строка, не 0/NaN/мусор', () => {
    const text = formatPlanMetrics(EMPTY);
    expect(text).toContain('🗂 <b>План работы с клиентом</b> (за месяц)');
    expect(text).toContain(
      'Пока никто из терапевтов не добавлял пункты в план.',
    );
    expect(text).not.toMatch(/NaN|undefined|— 0|: 0/);
  });

  it('пункты из справочника и свои, отметки статусов', () => {
    const text = formatPlanMetrics({
      added30: 9,
      fromGuide30: 6,
      therapists30: 2,
      active30: 4,
      done30: 3,
    });
    expect(text).toContain(
      'Добавлено пунктов: 9 (из справочника — 6, своих — 3), терапевтов: 2',
    );
    expect(text).toContain('Отмечено «в работе» — 4, «сделано» — 3');
  });

  it('нулевые части не печатаются', () => {
    const text = formatPlanMetrics({
      ...EMPTY,
      added30: 2,
      therapists30: 1,
    });
    expect(text).toContain('Добавлено пунктов: 2 (своих — 2), терапевтов: 1');
    expect(text).toContain('Ни один пункт пока не отмечали');
    expect(text).not.toMatch(/NaN|undefined|— 0|: 0/);
  });
});
