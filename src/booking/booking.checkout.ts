import { Booking, BookingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BookingNotifyService } from './booking-notify.service';
import { RobokassaService } from './robokassa.service';
import { decryptRecord, EncryptSchema } from '../utils/crypto';
import { assertPaymentAvailable } from './payment-guard';

// После создания брони: бесплатная и платная не в рублях подтверждаются сразу,
// платная в рублях получает ссылку на оплату (правило №10: из booking.service.ts).

/** Loose e-mail check — enough to decide whether to forward it to Robokassa. */
function isEmail(s: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.trim());
}

export interface CheckoutDeps {
  prisma: PrismaService;
  notify: BookingNotifyService;
  robokassa: RobokassaService;
  siteUrl: string;
  schema: EncryptSchema;
}

export interface BookingResult {
  id: number;
  cancelToken: string;
  heldUntil: Date | null;
  status: BookingStatus;
  paymentUrl: string | null;
  meetingUrl: string | null;
}

/** Подтвердить бронь сразу: расшифровать, уведомить, отдать CONFIRMED-ответ
 * (бесплатная сессия и dev-режим без Robokassa — один путь). */
async function confirmNow(
  deps: CheckoutDeps,
  booking: Booking,
  cancelToken: string,
): Promise<BookingResult> {
  const plain = decryptRecord(booking, deps.schema);
  await deps.notify.onConfirmed(plain);
  return {
    id: booking.id,
    cancelToken,
    heldUntil: null,
    status: BookingStatus.CONFIRMED,
    paymentUrl: null,
    meetingUrl: plain.meetingUrl ?? null,
  };
}

export async function completeCheckout(
  deps: CheckoutDeps,
  booking: Booking,
  opts: {
    isFree: boolean;
    manual?: boolean; // платная не в рублях: подтверждается сразу, без Robokassa
    cancelToken: string;
    heldUntil: Date | null;
    startsAt: Date;
    clientContact: string;
    adminNote?: string; // пометка админу в «ожидает оплаты», клиенту не видна
  },
): Promise<BookingResult> {
  const { isFree, manual, cancelToken, heldUntil } = opts;
  if (isFree || manual) return confirmNow(deps, booking, cancelToken);

  // Вторая линия обороны: book() отказывает раньше, до INSERT (payment-guard).
  assertPaymentAvailable(deps.robokassa, 'booking');
  // Dev без Robokassa: auto-confirm (строку создал этот запрос, токен не отдан).
  if (!deps.robokassa.enabled) {
    await deps.prisma.booking.updateMany({
      where: { id: booking.id, status: BookingStatus.HELD },
      data: { status: BookingStatus.CONFIRMED, heldUntil: null },
    });
    return confirmNow(deps, booking, cancelToken);
  }

  // Paid session — build Robokassa payment URL по сумме счёта, сохранённой в
  // брони при записи (не по второму чтению цены: она могла смениться).
  if (booking.amount == null) {
    throw new Error(`Booking ${booking.id} has no invoiced amount`);
  }
  const paymentUrl = deps.robokassa.buildPaymentUrl({
    invId: booking.id,
    amount: booking.amount,
    desc: `Психологическая сессия ${new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' }).format(opts.startsAt)} МСК`,
    // Pass the client's e-mail so Robokassa / «Мой налог» can send the cheque.
    // Only when the contact actually is an e-mail (could be a phone / @handle).
    email: isEmail(opts.clientContact) ? opts.clientContact : undefined,
    successUrl: `${deps.siteUrl}/api/payment/success`,
    failUrl: `${deps.siteUrl}/api/payment/fail`,
  });
  // Admin hears "awaiting payment": the lead survives a failed payment.
  const plain = decryptRecord(booking, deps.schema);
  await deps.notify.onAwaitingPayment(plain, opts.adminNote);

  return {
    id: booking.id,
    cancelToken,
    heldUntil,
    status: BookingStatus.HELD,
    paymentUrl,
    meetingUrl: null,
  };
}
