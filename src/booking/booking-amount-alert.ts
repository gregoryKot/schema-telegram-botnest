import { ConflictException } from '@nestjs/common';
import type { Booking } from '@prisma/client';
import type { BookingNotifyService } from './booking-notify.service';

/**
 * Thrown by confirm() when the webhook-reported paid amount doesn't match
 * the invoiced price. A distinct ConflictException subclass so PaymentController
 * tells it apart from an idempotent-repeat: opposite Robokassa acks — repeat
 * → "OK" (already handled), mismatch → "FAIL" (NOT handled, keep it visible).
 */
export class PaymentAmountMismatchError extends ConflictException {}

/** Сигнал владельцу и отказ авто-подтверждения: бронь остаётся как есть. */
export async function rejectPayment(
  notify: Pick<BookingNotifyService, 'alertAdmin'>,
  text: string,
): Promise<never> {
  await notify.alertAdmin(text);
  throw new PaymentAmountMismatchError('Amount mismatch — manual review');
}

const TAIL =
  'Бронь НЕ подтверждена автоматически: нужна ручная проверка и подтверждение.';

/** Рублёвый счёт не сошёлся с оплатой; цена в админке могла уйти от счёта — видны обе. */
export function mismatchAlert(
  id: number,
  sums: { invoiced: number; current: number; legacy: boolean },
  paidAmount: number,
): string {
  const { invoiced, current, legacy } = sums;
  const price = legacy
    ? `Ожидали ${invoiced} ₽ (у брони нет сохранённой суммы, сверка с текущей ценой)`
    : `Выставлен счёт на ${invoiced} ₽ (цена на момент записи${current === invoiced ? '' : `, сейчас в админке ${current} ₽`})`;
  return `⚠️ <b>Бронь #${id}: сумма расходится</b>\n${price}, оплатили ${paidAmount} ₽. ${TAIL}`;
}

/** Вебхук Robokassa пришёл по брони не в рублях: счёт на неё не выставлялся. */
export function foreignCurrencyAlert(
  booking: Pick<Booking, 'id' | 'amount'> & { currency?: string },
  paidAmount: number,
): string {
  const price = `${booking.amount ?? '?'} ${booking.currency}`;
  return `⚠️ <b>Бронь #${booking.id}: оплата не по тому счёту</b>\nБронь выставлена в другой валюте (${price}, оплата по договорённости), счёт в Robokassa на неё не выставлялся, а пришла оплата ${paidAmount} ₽. ${TAIL}`;
}
