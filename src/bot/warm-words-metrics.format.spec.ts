import { formatWarmWordsMetrics } from './warm-words-metrics.format';

describe('formatWarmWordsMetrics', () => {
  it('пустая БД — человеческая строка, не 0/NaN/мусор', () => {
    const text = formatWarmWordsMetrics({ opens30: 0, users30: 0 });
    expect(text).toContain('Тёплые слова');
    expect(text).toContain('Пока никто не заглядывал в свои тёплые слова.');
    expect(text).not.toMatch(/NaN|undefined/);
  });

  it('заполненная БД — счётчик открытий и число людей', () => {
    const text = formatWarmWordsMetrics({ opens30: 23, users30: 9 });
    expect(text).toContain('Открывали свои тёплые слова: 23 раз (9 человек)');
  });
});
