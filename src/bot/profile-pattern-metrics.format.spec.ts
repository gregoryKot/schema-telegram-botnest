import { formatProfilePatternMetrics } from './profile-pattern-metrics.format';

describe('formatProfilePatternMetrics', () => {
  it('пустая БД — человеческая строка, не 0/NaN/мусор', () => {
    const text = formatProfilePatternMetrics({
      schemaOpens30: 0,
      modeOpens30: 0,
    });
    expect(text).toContain('Паттерны со вкладки «Я»');
    expect(text).toContain(
      'Пока никто не открывал схемы или режимы со вкладки «Я».',
    );
    expect(text).not.toMatch(/NaN|undefined/);
  });

  it('заполненная БД — раздельные счётчики схем и режимов', () => {
    const text = formatProfilePatternMetrics({
      schemaOpens30: 12,
      modeOpens30: 7,
    });
    expect(text).toContain(
      'Из вкладки «Я» открывали схемы 12 раз, режимы 7 раз',
    );
  });

  it('только один вид паттерна открывали — второй тоже виден нулём', () => {
    const text = formatProfilePatternMetrics({
      schemaOpens30: 5,
      modeOpens30: 0,
    });
    expect(text).toContain('открывали схемы 5 раз, режимы 0 раз');
  });
});
