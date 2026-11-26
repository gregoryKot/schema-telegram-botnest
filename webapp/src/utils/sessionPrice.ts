// Цена формата записи в валюте посетителя. Сервер отдаёт `prices` по четырём
// валютам; страна = часовой пояс, и тот же пояс уходит в `clientTimeZone` при
// записи, поэтому показанная цена совпадает с той, что посчитает сервер.
import {
  formatPrice,
  isOnlinePaymentCurrency,
  type Currency,
} from '../../../shared/src/booking/priceRegion';
import type { SessionOption } from '../api.types';

export interface OptionPrice {
  amount: number;
  currency: Currency;
  /** «4 000 ₽», «70 $» */
  text: string;
  /** Онлайн-оплата (Robokassa) есть только в рублях. */
  online: boolean;
}

export function makePrice(amount: number, currency: Currency): OptionPrice {
  return { amount, currency, text: formatPrice(amount, currency), online: isOnlinePaymentCurrency(currency) };
}

/**
 * Цена опции в валюте `currency`. Старый ответ сервера (без `prices` или без
 * нужной валюты) — это рубли: так бэкенд и считал до многовалютности, и
 * показывать «70 $» из воздуха нельзя.
 */
export function optionPrice(
  opt: Pick<SessionOption, 'price' | 'prices'> | undefined,
  currency: Currency,
): OptionPrice {
  if (!opt) return makePrice(0, currency);
  const own = opt.prices?.[currency];
  if (typeof own === 'number' && Number.isFinite(own)) return makePrice(own, currency);
  return makePrice(opt.price, 'RUB');
}

/**
 * Цена, пока ответ API не пришёл (или упал): решение владельца 2026-10-20 —
 * та же четвёрка, что на сервере. Админка меняет живую цену, она заменяет
 * этот дефолт сразу, как приходит ответ.
 */
export const DEFAULT_SESSION_PRICE: Record<Currency, number> = { RUB: 4000, ILS: 200, EUR: 65, USD: 70 };
