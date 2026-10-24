import { SessionType } from '@prisma/client';
import { isValidTimeZone } from './client-timezone';
import type { PricingService } from './pricing.service';
import {
  Currency,
  currencyFromTimeZone,
  isOnlinePaymentCurrency,
} from './price-region';

/** Сколько минут HELD-бронь держит слот в ожидании оплаты. */
export const HOLD_MINUTES = 15;

/**
 * Путь оплаты записи (решение владельца 2026-10-20): валюта берётся из пояса
 * посетителя; вне рублей онлайн-оплаты нет — бронь платной сессии подтверждается
 * сразу, а об оплате владелец договаривается сам (`manual`).
 */
export interface BookingPricePath {
  /** Бесплатное знакомство. */
  isFree: boolean;
  currency: Currency;
  /** Платная сессия не в рублях: без Robokassa, подтверждена сразу. */
  manual: boolean;
  /** Сумма счёта в `currency`; null у бесплатного знакомства. */
  amount: number | null;
  /** До какого момента HELD держит слот; null — подтверждена сразу. */
  heldUntil: Date | null;
}

export async function resolveBookingPrice(
  pricing: Pick<PricingService, 'getPrice'>,
  dto: { type: SessionType; clientTimeZone?: string },
  now = Date.now(),
): Promise<BookingPricePath> {
  const isFree = dto.type === SessionType.INTRO_15;
  // Невалидный пояс игнорируется, как при записи в Booking.clientTimeZone.
  const tz = dto.clientTimeZone;
  const currency = currencyFromTimeZone(tz && isValidTimeZone(tz) ? tz : null);
  const manual = !isFree && !isOnlinePaymentCurrency(currency);
  // Сумма фиксируется в брони сейчас: оплата сверяется с ней, а не с ценой на
  // момент вебхука; та же сумма уходит в Robokassa (booking.checkout).
  const amount = isFree ? null : await pricing.getPrice(dto.type, currency);
  const heldUntil =
    isFree || manual ? null : new Date(now + HOLD_MINUTES * 60_000);
  return { isFree, currency, manual, amount, heldUntil };
}

/** Состояние новой брони для лога: «CONFIRMED», «HELD», «CONFIRMED, manual payment USD». */
export function pathLabel(p: BookingPricePath): string {
  if (p.manual) return `CONFIRMED, manual payment ${p.currency}`;
  return p.isFree ? 'CONFIRMED' : 'HELD';
}
