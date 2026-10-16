import { ConflictException } from '@nestjs/common';
import type { Booking } from '@prisma/client';
import type { BookingNotifyService } from './booking-notify.service';
import type { PricingService } from './pricing.service';

/**
 * Thrown by confirm() when the webhook-reported paid amount doesn't match
 * the invoiced price. A distinct ConflictException subclass so PaymentController
 * tells it apart from an idempotent-repeat: opposite Robokassa acks — repeat
 * → "OK" (already handled), mismatch → "FAIL" (NOT handled, keep it visible).
 */
export class PaymentAmountMismatchError extends ConflictException {}

/**
 * Сверка суммы вебхука со счётом брони (P-4, аудит 2026-07). Счёт — это
 * `Booking.amount`, цена на момент записи: смена цены в админке между записью
 * и оплатой не должна делать честный платёж «расхождением». Брони до миграции
 * без `amount` сверяются с текущей ценой, как раньше. Вынесено из
 * booking.service.ts (правило №10).
 */
export async function assertPaidAmount(
  deps: {
    pricing: Pick<PricingService, 'getPrice'>;
    notify: Pick<BookingNotifyService, 'alertAdmin'>;
  },
  booking: Pick<Booking, 'id' | 'type' | 'amount'>,
  paidAmount: number,
): Promise<void> {
  const legacy = booking.amount == null;
  const invoiced =
    booking.amount ?? (await deps.pricing.getPrice(booking.type));
  if (Math.round(paidAmount) === invoiced) return;
  // Цена в админке могла уйти от счёта — владельцу видны обе суммы.
  const current = legacy ? invoiced : await deps.pricing.getPrice(booking.type);
  const price = legacy
    ? `Ожидали ${invoiced} ₽ (у брони нет сохранённой суммы, сверка с текущей ценой)`
    : `Выставлен счёт на ${invoiced} ₽ (цена на момент записи${current === invoiced ? '' : `, сейчас в админке ${current} ₽`})`;
  await deps.notify.alertAdmin(
    `⚠️ <b>Бронь #${booking.id}: сумма расходится</b>\n${price}, оплатили ${paidAmount} ₽. Бронь НЕ подтверждена автоматически — проверьте и подтвердите вручную.`,
  );
  throw new PaymentAmountMismatchError('Amount mismatch — manual review');
}
