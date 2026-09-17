import { Booking, BookingStatus, SessionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BookingNotifyService } from './booking-notify.service';
import { RobokassaService } from './robokassa.service';
import { PricingService } from './pricing.service';
import { decryptRecord, EncryptSchema } from '../utils/crypto';

// Что происходит после создания брони: бесплатная сессия подтверждается
// сразу, платная получает ссылку на оплату (или тоже подтверждается, если
// Robokassa не настроена — dev). Вынесено из booking.service.ts (правило №10).

/** Loose e-mail check — enough to decide whether to forward it to Robokassa. */
function isEmail(s: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.trim());
}

export interface CheckoutDeps {
  prisma: PrismaService;
  notify: BookingNotifyService;
  robokassa: RobokassaService;
  pricing: PricingService;
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

/**
 * Подтвердить бронь сразу: расшифровать, уведомить, отдать CONFIRMED-ответ.
 * Один путь для бесплатной сессии и для dev-режима без Robokassa — раньше
 * этот блок стоял в двух местах слово в слово.
 */
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
    cancelToken: string;
    heldUntil: Date | null;
    startsAt: Date;
    type: SessionType;
    clientContact: string;
  },
): Promise<BookingResult> {
  const { isFree, cancelToken, heldUntil } = opts;
  if (isFree) return confirmNow(deps, booking, cancelToken);

  // Robokassa not configured (dev): auto-confirm so slot isn't stuck in HELD.
  if (!deps.robokassa.enabled) {
    await deps.prisma.booking.update({
      where: { id: booking.id },
      data: { status: BookingStatus.CONFIRMED, heldUntil: null },
    });
    return confirmNow(deps, booking, cancelToken);
  }

  // Paid session — build Robokassa payment URL.
  const price = await deps.pricing.getPrice(opts.type);
  const paymentUrl = deps.robokassa.buildPaymentUrl({
    invId: booking.id,
    amount: price,
    desc: `Психологическая сессия ${new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' }).format(opts.startsAt)} МСК`,
    // Pass the client's e-mail so Robokassa / «Мой налог» can send the cheque.
    // Only when the contact actually is an e-mail (could be a phone / @handle).
    email: isEmail(opts.clientContact) ? opts.clientContact : undefined,
    successUrl: `${deps.siteUrl}/api/payment/success`,
    failUrl: `${deps.siteUrl}/api/payment/fail`,
  });
  // Tell the admin a slot is reserved & awaiting payment — so even if the
  // client's payment fails (or Robokassa is misconfigured), the request and
  // contact are never lost.
  await deps.notify.onAwaitingPayment(decryptRecord(booking, deps.schema));

  return {
    id: booking.id,
    cancelToken,
    heldUntil,
    status: BookingStatus.HELD,
    paymentUrl,
    meetingUrl: null,
  };
}
