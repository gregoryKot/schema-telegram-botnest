// Строка цены в карточке брони для админа: только вне рублей и только с суммой.
import { bookingCardText } from './booking-notify.format';
import { priceLine } from './booking-notify.price';

describe('priceLine', () => {
  it.each([
    [70, 'USD', '70 $'],
    [200, 'ILS', '200 ₪'],
    [65, 'EUR', '65 €'],
  ])(
    '%i %s → «💳 %s · оплата по договорённости (не Robokassa)»',
    (amount, currency, shown) => {
      expect(priceLine({ amount, currency })).toBe(
        `💳 ${shown} · оплата по договорённости (не Robokassa)`,
      );
    },
  );

  it.each([
    [{ amount: 4000, currency: 'RUB' }],
    [{ amount: 70, currency: null }],
    [{ amount: 70 }],
    [{ amount: null, currency: 'USD' }],
    [{ currency: 'USD' }],
    [{ amount: 70, currency: 'XXX' }],
    [{}],
  ])('нет строки для %j', (fields) => {
    expect(priceLine(fields)).toBeNull();
  });
});

describe('bookingCardText — цена', () => {
  const card = {
    clientName: 'Иван',
    clientContact: '@ivan',
    startsAt: new Date('2026-09-30T12:00:00Z'),
    message: null,
  };

  it('не в рублях: строка цены в карточке', () => {
    const text = bookingCardText('Заголовок', {
      ...card,
      amount: 70,
      currency: 'USD',
    });
    expect(text).toContain('💳 70 $ · оплата по договорённости (не Robokassa)');
  });

  it('рубли и знакомство: карточка как раньше, без строки цены и мусора', () => {
    for (const extra of [
      { amount: 4000, currency: 'RUB' },
      { amount: null, currency: 'ILS' },
      {},
    ]) {
      const text = bookingCardText('Заголовок', { ...card, ...extra });
      expect(text).not.toContain('💳');
      expect(text).not.toMatch(/undefined|null|NaN/);
    }
  });
});
