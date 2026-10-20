import { CURRENCIES, Currency, formatPrice } from './price-region';

// Строка с ценой в карточке брони для админа. Вне рублей онлайн-оплаты нет:
// бронь подтверждена сразу, и владельцу нужно видеть, сколько и в чём договариваться.

/** Поля брони, нужные для строки цены. */
export interface PriceFields {
  /** Сумма в валюте `currency`; null у бесплатного знакомства. */
  amount?: number | null;
  /** Код валюты (RUB | ILS | EUR | USD). */
  currency?: string | null;
}

const isCurrency = (c: string): c is Currency =>
  (CURRENCIES as readonly string[]).includes(c);

/** «💳 70 $ · оплата по договорённости (не Robokassa)»; для рублей и без суммы — null. */
export function priceLine(b: PriceFields): string | null {
  if (b.amount == null || !b.currency || b.currency === 'RUB') return null;
  if (!isCurrency(b.currency)) return null;
  return `💳 ${formatPrice(b.amount, b.currency)} · оплата по договорённости (не Robokassa)`;
}
