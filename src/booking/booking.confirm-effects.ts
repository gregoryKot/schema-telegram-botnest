import { InternalServerErrorException } from '@nestjs/common';
import { Booking } from '@prisma/client';
import { BookingNotifyService } from './booking-notify.service';
import { BOOKING_SCHEMA } from './booking.schema';
import { decryptRecord } from '../utils/crypto';

// Побочные эффекты подтверждения брони (ссылка на встречу, календарь, DM):
// общий вход для confirm() (CAS-победитель, повтор вебхука, ручное
// подтверждение админом) и для крон-добора. Вынесено из booking.service.ts
// (правило №10). Глобальный аудит 2026-10-11, security#21.

/**
 * Бронь УЖЕ CONFIRMED (CAS прошёл), а эффекты не доехали. Не
 * ConflictException: для PaymentController это не «нечего подтверждать», а
 * «вебхук надо повторить» — ответ FAIL и честный алерт «подтверждена, но
 * ссылка и календарь ещё не готовы». Сообщение читает владелец в админке.
 */
export class ConfirmEffectsFailedError extends InternalServerErrorException {
  constructor(
    readonly bookingId: number,
    readonly cause: unknown,
  ) {
    super(
      `Бронь #${bookingId} подтверждена, но ссылка на встречу и календарь ещё не готовы (${(cause as Error)?.message ?? 'ошибка'}). Повторите подтверждение или дождитесь автоматического добора.`,
    );
  }
}

/**
 * Довести эффекты подтверждения по строке брони. Флаг уже стоит — ничего не
 * делает и возвращает false. Любое исключение эффектов заворачивается в
 * ConfirmEffectsFailedError: к этому моменту бронь подтверждена, и вызывающий
 * обязан отличать это от «подтвердить не удалось».
 */
export async function finishConfirmEffects(
  notify: BookingNotifyService,
  row: Booking,
  /**
   * Не трогать строку, писанную моложе этого (мс): её проход, скорее всего,
   * ещё идёт (каждая запись прохода двигает updatedAt). Без этого повтор
   * вебхука или двойной клик админа создали бы вторую Zoom-встречу, и
   * clientMeeting.create упал бы на @id clientKey.
   */
  minAgeMs = 0,
): Promise<boolean> {
  if (row.confirmEffectsDoneAt) return false;
  if (minAgeMs > 0 && row.updatedAt.getTime() > Date.now() - minAgeMs)
    return false;
  try {
    await notify.onConfirmed(decryptRecord(row, BOOKING_SCHEMA));
  } catch (e) {
    throw new ConfirmEffectsFailedError(row.id, e);
  }
  return true;
}

/** Возраст строки, моложе которого повтор в confirm() её не трогает. */
const RERUN_AFTER_MS = 60_000;

/** Повтор из confirm() (вебхук, ручное подтверждение): не перебивает идущий проход. */
export function rerunEffects(
  notify: BookingNotifyService,
  row: Booking,
): Promise<boolean> {
  return finishConfirmEffects(notify, row, RERUN_AFTER_MS);
}
