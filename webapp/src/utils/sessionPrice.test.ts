import { describe, it, expect } from 'vitest';
import { DEFAULT_SESSION_PRICE, makePrice, optionPrice } from './sessionPrice';
import { formatPrice } from '../../../shared/src/booking/priceRegion';

const WITH_PRICES = { price: 4000, prices: { RUB: 4000, ILS: 200, EUR: 65, USD: 70 } };

describe('optionPrice — цена опции в валюте посетителя', () => {
  it.each([
    ['RUB', 4000, true],
    ['ILS', 200, false],
    ['EUR', 65, false],
    ['USD', 70, false],
  ] as const)('%s: берётся prices[%s], онлайн-оплата только в рублях', (currency, amount, online) => {
    const p = optionPrice(WITH_PRICES, currency);
    expect(p).toEqual({ amount, currency, text: formatPrice(amount, currency), online });
  });

  it('старый ответ без prices — рубли из price, какой бы валюта ни была', () => {
    const p = optionPrice({ price: 3000 }, 'USD');
    expect(p.currency).toBe('RUB');
    expect(p.amount).toBe(3000);
    expect(p.online).toBe(true);
  });

  it('в prices нет нужной валюты — тоже рубли, а не NaN/undefined', () => {
    const partial = { price: 4000, prices: { RUB: 4000 } } as unknown as Parameters<typeof optionPrice>[0];
    const p = optionPrice(partial, 'EUR');
    expect(p.currency).toBe('RUB');
    expect(p.text).toBe(formatPrice(4000, 'RUB'));
  });

  it('нет опции — ноль в запрошенной валюте (формат не платный)', () => {
    expect(optionPrice(undefined, 'ILS')).toEqual(makePrice(0, 'ILS'));
  });

  it('бесплатная опция: 0 остаётся нулём в любой валюте', () => {
    expect(optionPrice({ price: 0, prices: { RUB: 0, ILS: 0, EUR: 0, USD: 0 } }, 'USD').amount).toBe(0);
  });
});

describe('DEFAULT_SESSION_PRICE', () => {
  it('решение владельца 2026-10-20: 4 000 ₽ / 200 ₪ / 65 € / 70 $', () => {
    expect(DEFAULT_SESSION_PRICE).toEqual({ RUB: 4000, ILS: 200, EUR: 65, USD: 70 });
  });
});
