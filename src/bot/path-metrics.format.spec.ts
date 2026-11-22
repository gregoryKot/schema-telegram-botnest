import { formatPathMetrics } from './path-metrics.format';
import type { PathMetrics } from './path-metrics.types';

const EMPTY: PathMetrics = {
  created30: 0,
  phasesStarted30: 0,
  phasesFinished30: 0,
  sessionsMarked30: 0,
  shifted30: 0,
  drafts30: 0,
};

describe('formatPathMetrics', () => {
  it('пустая БД — человеческая строка, не 0/NaN/мусор', () => {
    const text = formatPathMetrics(EMPTY);
    expect(text).toContain('🧭 <b>Путь клиента</b> (за месяц)');
    expect(text).toContain('Пока никто не собирал путь.');
    expect(text).not.toMatch(/NaN|undefined|: 0/);
  });

  it('печатает только ненулевые строки', () => {
    const text = formatPathMetrics({
      ...EMPTY,
      created30: 3,
      phasesStarted30: 5,
      shifted30: 1,
    });
    expect(text).toContain('Путей собрано: 3');
    expect(text).toContain('Фаз начато: 5');
    expect(text).toContain('Раз сдвигали сроки: 1');
    expect(text).not.toMatch(/Фаз завершено|Черновиков|NaN|: 0/);
  });
});
