import { BadRequestException, ConflictException } from '@nestjs/common';
import { Booking, BookingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { PlainBooking } from './booking-notify.service';

// Переходы статуса брони. Правило одно: каждый переход — CAS, то есть
// `updateMany` с предикатом на ТЕКУЩИЙ статус в WHERE, а побочные эффекты
// (уведомления, календарь) делаются только по строкам, которые этот вызов
// реально перевёл (count === 1). Снимок, прочитанный до записи, статус не
// гарантирует: между findMany и updateMany успевает вебхук оплаты (аудит
// 2026-10-11, r2-1#0/#1). Вынесено из booking.service.ts (правило №10).

/**
 * confirm() получил верную оплату, а бронь уже CANCELLED (холд истёк или
 * клиент отменил, потом заплатил по старой ссылке). Не «повтор вебхука»:
 * деньги у нас, брони нет. Отдельный класс, чтобы PaymentController не
 * смешал его с идемпотентным повтором и сообщил владельцу (правило №14:
 * обработанная авария невидимее необработанной).
 */
export class PaymentAfterCancelError extends ConflictException {
  constructor(
    readonly booking: PlainBooking,
    readonly paidAmount: number | undefined,
  ) {
    super(`Payment received for booking ${booking.id} in status CANCELLED`);
  }
}

/**
 * Оплата по отменённой броне: сначала факт оплаты в БД (`paidAt`, идемпотентно —
 * уже стоящий не затирается), потом ошибка для вызывающего, которую он бросит.
 */
export async function paymentAfterCancel(
  prisma: PrismaService,
  booking: PlainBooking,
  paidAmount: number,
): Promise<PaymentAfterCancelError> {
  await prisma.booking.updateMany({
    where: { id: booking.id, paidAt: null },
    data: { paidAt: new Date() },
  });
  return new PaymentAfterCancelError(booking, paidAmount);
}

/**
 * Перевести просроченные HELD в CANCELLED. Возвращает ровно те строки,
 * которые перевёл ЭТОТ вызов: бронь, которую за миллисекунды до того
 * подтвердил вебхук, WHERE не пройдёт, и «истекла без оплаты» по ней не уйдёт.
 * Истекающих за тик единицы — построчный CAS дешевле и проще, чем
 * `UPDATE … RETURNING` через $queryRaw (тот потянул бы живой спек, правило №18).
 */
export async function expireHeldBookings(
  prisma: PrismaService,
  now: Date = new Date(),
): Promise<Booking[]> {
  const candidates = await prisma.booking.findMany({
    where: { status: BookingStatus.HELD, heldUntil: { lte: now } },
  });
  const expired: Booking[] = [];
  for (const b of candidates) {
    const r = await prisma.booking.updateMany({
      where: {
        id: b.id,
        status: BookingStatus.HELD,
        heldUntil: { lte: now },
      },
      data: { status: BookingStatus.CANCELLED, heldUntil: null },
    });
    if (r.count === 1) expired.push(b);
  }
  return expired;
}

/**
 * Захватить отмену по токену: HELD/CONFIRMED → CANCELLED. Возвращает свежую
 * строку (calDavUid берётся ПОСЛЕ перехода — подтверждение, выигравшее гонку,
 * успело записать событие в календарь) либо null, если отменять нечего:
 * уже CANCELLED (повторный или параллельный вызов — идемпотентный успех, без
 * повторных DM/писем/DELETE). COMPLETED — отказ. `snapshot` — строка, прочитанная
 * вызывающим для проверок; в запись она не идёт, только запасной ответ.
 */
export async function claimCancel(
  prisma: PrismaService,
  cancelToken: string,
  snapshot: Booking,
): Promise<Booking | null> {
  const claimed = await prisma.booking.updateMany({
    where: {
      cancelToken,
      status: { in: [BookingStatus.HELD, BookingStatus.CONFIRMED] },
    },
    data: { status: BookingStatus.CANCELLED, heldUntil: null },
  });
  const now = await prisma.booking.findUnique({ where: { cancelToken } });
  if (claimed.count === 0) {
    if (now?.status === BookingStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel completed session');
    }
    return null;
  }
  return now ?? snapshot;
}
