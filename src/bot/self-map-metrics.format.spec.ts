import {
  EMPTY_SELF_MAP_METRICS,
  formatSelfMapMetrics,
} from './self-map-metrics.format';

describe('formatSelfMapMetrics', () => {
  it('пустая БД: честное «пока никто», без нулей и NaN', () => {
    const t = formatSelfMapMetrics(EMPTY_SELF_MAP_METRICS);
    expect(t).toContain('Пока никто не переходил');
    expect(t).not.toMatch(/NaN|undefined/);
  });

  it('показывает все пять переходов', () => {
    const t = formatSelfMapMetrics({
      mode: 5,
      schema: 4,
      patterns: 3,
      ysq_test: 2,
      map: 1,
    });
    expect(t).toContain(
      'В карточку режима 5 · в схему 4 · в «Мои паттерны» 3 · в тест 2 · из «Моих паттернов» на карту 1',
    );
  });
});
