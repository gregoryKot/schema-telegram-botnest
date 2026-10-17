import { describe, it, expect } from 'vitest';
import { yearDiscountPercent, periodLabel } from './subscribeDiscount';

const opts = (month?: number, year?: number) => [
  ...(month === undefined ? [] : [{ period: 'month' as const, price: month }]),
  ...(year === undefined ? [] : [{ period: 'year' as const, price: year }]),
];

describe('yearDiscountPercent', () => {
  it('считает скидку из цен API и округляет', () => {
    expect(yearDiscountPercent(opts(299, 2990))).toBe(17);
    expect(yearDiscountPercent(opts(100, 600))).toBe(50);
  });
  it('0, если года дешевле нет (равные или большие цены)', () => {
    expect(yearDiscountPercent(opts(100, 1200))).toBe(0);
    expect(yearDiscountPercent(opts(100, 1500))).toBe(0);
  });
  it('0, если нет одной из цен или пусто', () => {
    expect(yearDiscountPercent(opts(299))).toBe(0);
    expect(yearDiscountPercent(opts(undefined, 2990))).toBe(0);
    expect(yearDiscountPercent([])).toBe(0);
    expect(yearDiscountPercent(opts(0, 100))).toBe(0);
  });
});

describe('periodLabel', () => {
  it('год и месяц', () => {
    expect(periodLabel('year')).toBe('год');
    expect(periodLabel('month')).toBe('месяц');
  });
});
