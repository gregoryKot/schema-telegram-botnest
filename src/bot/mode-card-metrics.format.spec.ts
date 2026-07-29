import { formatModeCardMetrics } from './mode-card-metrics.format';

describe('formatModeCardMetrics', () => {
  it('пустая БД — человеческая строка, не 0/NaN/мусор', () => {
    const text = formatModeCardMetrics({
      saved30: 0,
      users30: 0,
      avgFilled30: 0,
    });
    expect(text).toContain('Карточки режимов');
    expect(text).toContain('Пока никто не заполнял карточку режима.');
    expect(text).not.toMatch(/NaN|undefined/);
  });

  it('заполненная БД — счётчик, число людей и среднее число полей', () => {
    const text = formatModeCardMetrics({
      saved30: 42,
      users30: 17,
      avgFilled30: 4.5,
    });
    expect(text).toContain(
      'Карточек режимов заполнено: 42 (у 17 человек), в среднем полей — 4.5 из 7',
    );
  });
});
