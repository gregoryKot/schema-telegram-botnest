// Блок «Сессии не в рублях»: пустое состояние (чистая база) без «0/NaN/мусора»,
// заполненное — простыми словами и с разбивкой по валютам.
import { formatSessionCurrencyMetrics } from './session-currency-metrics.format';

describe('formatSessionCurrencyMetrics', () => {
  it('пустая база: одна строка, без цифр, NaN и undefined', () => {
    const out = formatSessionCurrencyMetrics({ week: {}, allTime: {} });
    expect(out).toBe(
      '💱 <b>Сессии не в рублях</b>\nПока таких сессий не было.',
    );
    expect(out).not.toMatch(/NaN|undefined|null|\b0\b/);
  });

  it('есть за всё время, за неделю нет: «ни одной», а не «0»', () => {
    const out = formatSessionCurrencyMetrics({
      week: {},
      allTime: { EUR: 1 },
    });
    expect(out).toContain('За 7 дней: ни одной');
    expect(out).toContain('За всё время: 1 (1 в евро)');
    expect(out).not.toMatch(/NaN|undefined|null/);
  });

  it('разбивка по валютам: шекели, евро, доллары — итог и составляющие', () => {
    const out = formatSessionCurrencyMetrics({
      week: { ILS: 1, USD: 1 },
      allTime: { ILS: 3, EUR: 1, USD: 1 },
    });
    expect(out).toContain('За 7 дней: 2 (1 в шекелях, 1 в долларах)');
    expect(out).toContain(
      'За всё время: 5 (3 в шекелях, 1 в евро, 1 в долларах)',
    );
    expect(out).toContain('деньги нужно получить самому');
  });

  it('нулевые счётчики валют не выводятся', () => {
    const out = formatSessionCurrencyMetrics({
      week: { ILS: 0, EUR: 2 },
      allTime: { ILS: 0, EUR: 2 },
    });
    expect(out).toContain('За 7 дней: 2 (2 в евро)');
    expect(out).not.toContain('шекел');
  });

  it('без кодов валют и английских терминов в тексте', () => {
    const out = formatSessionCurrencyMetrics({
      week: { USD: 1 },
      allTime: { USD: 1 },
    });
    expect(out).not.toMatch(/\b(ILS|EUR|USD|RUB)\b/);
  });
});
