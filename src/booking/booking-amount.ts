import type { Booking } from '@prisma/client';
import type { BookingNotifyService } from './booking-notify.service';
import type { PricingService } from './pricing.service';
import {
  foreignCurrencyAlert,
  mismatchAlert,
  rejectPayment,
} from './booking-amount-alert';

export { PaymentAmountMismatchError } from './booking-amount-alert';

/**
 * Сверка суммы вебхука со счётом брони (P-4, аудит 2026-07). Счёт — это
 * `Booking.amount`, цена на момент записи: смена цены в админке между записью
 * и оплатой не должна делать честный платёж «расхождением». Брони до миграции
 * без `amount` сверяются с текущей ценой, как раньше. Бронь не в рублях:
 * онлайн-счёт на неё не выставлялся, любая оплата — расхождение. Вынесено из
 * booking.service.ts (правило №10).
 */
export async function assertPaidAmount(
  deps: {
    pricing: Pick<PricingService, 'getPrice'>;
    notify: Pick<BookingNotifyService, 'alertAdmin'>;
  },
  booking: Pick<Booking, 'id' | 'type' | 'amount'> & { currency?: string },
  paidAmount: number,
): Promise<void> {
  if (booking.currency && booking.currency !== 'RUB') {
    const text = foreignCurrencyAlert(booking, paidAmount);
    return rejectPayment(deps.notify, text);
  }
  const legacy = booking.amount == null;
  const invoiced =
    booking.amount ?? (await deps.pricing.getPrice(booking.type));
  if (Math.round(paidAmount) === invoiced) return;
  const current = legacy ? invoiced : await deps.pricing.getPrice(booking.type);
  const sums = { invoiced, current, legacy };
  return rejectPayment(
    deps.notify,
    mismatchAlert(booking.id, sums, paidAmount),
  );
}
