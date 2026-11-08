// Строка цены в карточке брони для админа: только вне рублей и только с суммой.
import { bookingCardText } from './booking-notify.format';
import { CHOSEN_CURRENCY_NOTE, priceLine } from './booking-notify.price';

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

// Р5: пояс без места даёт рубли; другая валюта при нём — только явный выбор
// клиента. Владелец видит пометку, откуда у клиента без пояса евро.
describe('priceLine — валюта по выбору клиента', () => {
  it.each(['UTC', 'Etc/UTC', 'GMT'])(
    'пояс %s, евро: строка цены и пометка под ней',
    (clientTimeZone) => {
      expect(priceLine({ amount: 65, currency: 'EUR', clientTimeZone })).toBe(
        `💳 65 € · оплата по договорённости (не Robokassa)\n${CHOSEN_CURRENCY_NOTE}`,
      );
    },
  );

  it.each([['Asia/Bangkok'], ['Europe/Berlin'], [null], [undefined]])(
    'пояс %p — валюта по поясу, без пометки',
    (clientTimeZone) => {
      expect(
        priceLine({ amount: 65, currency: 'EUR', clientTimeZone }),
      ).not.toContain(CHOSEN_CURRENCY_NOTE);
    },
  );

  it('рубли и знакомство при поясе без места — ни цены, ни пометки', () => {
    expect(
      priceLine({ amount: 4000, currency: 'RUB', clientTimeZone: 'UTC' }),
    ).toBeNull();
    expect(
      priceLine({ amount: null, currency: 'EUR', clientTimeZone: 'UTC' }),
    ).toBeNull();
  });

  it('карточка брони несёт пометку и без обращения к читателю', () => {
    const text = bookingCardText('Заголовок', {
      clientName: 'Иван',
      clientContact: '@ivan',
      startsAt: new Date('2026-09-30T12:00:00Z'),
      message: null,
      amount: 70,
      currency: 'USD',
      clientTimeZone: 'UTC',
    });
    expect(text).toContain(CHOSEN_CURRENCY_NOTE);
    expect(CHOSEN_CURRENCY_NOTE).not.toMatch(
      /(^|[^а-яё])(ты|вы|тебя|тебе|вас|вам|ваш\S*|тво\S*)(?![а-яё])/i,
    );
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
