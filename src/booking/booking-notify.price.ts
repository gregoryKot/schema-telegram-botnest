import {
  CURRENCIES,
  Currency,
  formatPrice,
  isPlacelessTimeZone,
} from './price-region';

// Строка с ценой в карточке брони для админа. Вне рублей онлайн-оплаты нет:
// бронь подтверждена сразу, и владельцу нужно видеть, сколько и в чём договариваться.

/** Поля брони, нужные для строки цены. */
export interface PriceFields {
  /** Сумма в валюте `currency`; null у бесплатного знакомства. */
  amount?: number | null;
  /** Код валюты (RUB | ILS | EUR | USD). */
  currency?: string | null;
  /** Деньги пришли вебхуком Robokassa: отмена такой брони = возврат. */
  paidAt?: Date | null;
  /** IANA-пояс посетителя: без места (UTC) + не рубли = валюту выбрал клиент. */
  clientTimeZone?: string | null;
  /** Когда создана бронь: выбор валюты есть только с CURRENCY_CHOICE_SINCE. */
  createdAt?: Date | null;
}

/** Мерж волны 7 (#1034): с него пара «пояс без места + не рубли» бывает только
 * явным выбором (resolveBookingPrice). До волны 5 (#1025) тот же пояс давал
 * доллары по умолчанию — у брони старше метки пометка была бы ложной. */
export const CURRENCY_CHOICE_SINCE = new Date('2026-11-08T17:33:55Z');

const isCurrency = (c: string): c is Currency =>
  (CURRENCIES as readonly string[]).includes(c);

/** Пометка под ценой (Р5): пояс без места даёт рубли, другая валюта — только явным выбором. */
export const CHOSEN_CURRENCY_NOTE =
  '🌍 Валюта — по выбору клиента: часовой пояс не определился';

/** Валюту назначил явный выбор клиента (Р5), а не пояс; без даты — не утверждаем. */
const chosenByClient = (b: PriceFields): boolean =>
  isPlacelessTimeZone(b.clientTimeZone) &&
  !!b.createdAt &&
  b.createdAt.getTime() >= CURRENCY_CHOICE_SINCE.getTime();

/** «💳 70 $ · оплата по договорённости (не Robokassa)»; для рублей и без суммы — null. */
export function priceLine(b: PriceFields): string | null {
  if (b.amount == null || !b.currency || b.currency === 'RUB') return null;
  if (!isCurrency(b.currency)) return null;
  const line = `💳 ${formatPrice(b.amount, b.currency)} · оплата по договорённости (не Robokassa)`;
  return chosenByClient(b) ? `${line}\n${CHOSEN_CURRENCY_NOTE}` : line;
}
