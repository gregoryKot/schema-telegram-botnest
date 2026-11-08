// Строка «валюту выбрали сами» в блоке «Деньги» /stats (правило №8; решение
// владельца Р5): форматтер на пустую базу и подделку, запрос — только
// серверные строки за 30 дней. Связка «бронь → событие» —
// booking.book.spec.ts, «событие → отчёт» — money-metrics.service.spec.ts.
import {
  countCurrencyChosen,
  formatCurrencyChosen,
} from './booking-currency-metrics';

describe('formatCurrencyChosen', () => {
  it('пустая база — строки нет, без «0» и NaN', () => {
    expect(formatCurrencyChosen({})).toEqual([]);
  });

  it('одна валюта — число и склонение', () => {
    expect(formatCurrencyChosen({ EUR: 1 })).toEqual([
      'Часовой пояс не определился, и валюту выбрали сами (без онлайн-оплаты), за 30 дней: 1 запись (евро — 1).',
    ]);
  });

  it('несколько валют — порядок евро, доллары, шекели; сумма по ним', () => {
    const out = formatCurrencyChosen({ ILS: 2, USD: 1, EUR: 2 }).join('\n');
    expect(out).toContain('5 записей (евро — 2, доллары — 1, шекели — 2).');
    expect(out).not.toMatch(/UTC|IANA|NaN|undefined|currency/);
  });

  it('рубли и мусор в meta в счёт не идут', () => {
    expect(formatCurrencyChosen({ RUB: 3, XXX: 4 })).toEqual([]);
    expect(formatCurrencyChosen({ RUB: 3, USD: 2 }).join()).toContain(
      '2 записи (доллары — 2)',
    );
  });
});

describe('countCurrencyChosen', () => {
  it('только серверные строки (userId = null) за 30 дней; считает по meta.currency', async () => {
    const findMany = jest.fn(async () => [
      { meta: { currency: 'EUR' } },
      { meta: { currency: 'EUR' } },
      { meta: { currency: 'USD' } },
      { meta: null },
      { meta: { currency: 5 } },
    ]);
    const now = Date.parse('2026-11-08T12:00:00Z');

    const res = await countCurrencyChosen(
      { analyticsEvent: { findMany } } as never,
      now,
    );

    expect(res).toEqual({ EUR: 2, USD: 1 });
    expect(findMany).toHaveBeenCalledWith({
      where: {
        name: 'booking_currency_chosen',
        userId: null,
        createdAt: { gte: new Date('2026-10-09T12:00:00Z') },
      },
      select: { meta: true },
    });
  });
});
