import { SessionType } from '@prisma/client';
import { SESSION_DEFAULT_PRICE, SessionMeta } from './booking.config';
import { CURRENCIES, Currency } from './price-region';
import { parsePrice } from './price-rules';

// Цены сессий по валютам. Рубли — прежние ключ и дефолт (`price:SESSION_50`,
// SESSION_DEFAULT_PRICE), остальные валюты — ключ с суффиксом валюты. Живая
// цена правится в админке (BookingSetting) и сильнее дефолта из кода.

/** Дефолты по валютам (решение владельца 2026-10-20); знакомство бесплатно везде. */
export const DEFAULT_PRICE: Record<Currency, Record<SessionType, number>> = {
  RUB: SESSION_DEFAULT_PRICE,
  ILS: { [SessionType.INTRO_15]: 0, [SessionType.SESSION_50]: 200 },
  EUR: { [SessionType.INTRO_15]: 0, [SessionType.SESSION_50]: 65 },
  USD: { [SessionType.INTRO_15]: 0, [SessionType.SESSION_50]: 70 },
};

/** Каталог сессии: `price` — рубли (как раньше), `prices` — все валюты. */
export interface SessionOption extends SessionMeta {
  price: number;
  prices: Record<Currency, number>;
}

/** Ключ BookingSetting: `price:SESSION_50` для рублей, `price:SESSION_50:USD` для прочих. */
export function priceKey(type: SessionType, currency: Currency): string {
  return currency === 'RUB' ? `price:${type}` : `price:${type}:${currency}`;
}

/** Значение из BookingSetting → цена; нет или мусор — дефолт валюты. */
export function priceOrDefault(
  type: SessionType,
  currency: Currency,
  raw: string | undefined,
): number {
  return parsePrice(type, raw) ?? DEFAULT_PRICE[currency][type];
}

/** Цена во всех валютах; `get` читает одну (PricingService.getPrice). */
export async function pricesByCurrency(
  get: (currency: Currency) => Promise<number>,
): Promise<Record<Currency, number>> {
  const list = await Promise.all(
    CURRENCIES.map(async (c) => [c, await get(c)]),
  );
  return Object.fromEntries(list) as Record<Currency, number>;
}
