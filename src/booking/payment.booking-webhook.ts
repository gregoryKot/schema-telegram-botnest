import { ConflictException, Logger } from '@nestjs/common';
import { BookingService, PaymentAmountMismatchError } from './booking.service';
import { PaymentAfterCancelError } from './booking.transitions';
import { BookingNotifyService } from './booking-notify.service';
import { paidAfterCancelAlert } from './booking-paid-after-cancel';

/**
 * Ветка ResultURL для брони (InvId вне диапазонов подписок и донатов): что
 * ответить Robokassa. Ответ `OK<InvId>` = «обработано, повторов не нужно»,
 * любой другой — повтор уведомления. Вынесено из payment.controller.ts
 * (правило №10).
 */
export async function bookingWebhookReply(
  deps: {
    booking: BookingService;
    notify: BookingNotifyService;
    logger: Logger;
  },
  id: number,
  invId: string,
  paid: number | undefined,
): Promise<string> {
  const { booking, notify, logger } = deps;
  try {
    await booking.confirm(id, paid);
  } catch (e) {
    // Amount mismatch is NOT a benign repeat — do not ack money we didn't
    // verify as correct. BookingService.confirm already alerted the admin;
    // FAIL keeps Robokassa retrying/visible instead of silently swallowing
    // a potential fraud/misconfig case (see CLAUDE.md «Аудит-события»).
    if (e instanceof PaymentAmountMismatchError) {
      logger.warn(`Confirm booking ${id}: ${(e as Error).message}`);
      return `FAIL${invId}`;
    }
    // Оплата пришла по отменённой/истёкшей брони (аудит 2026-10-11, P1): деньги
    // списаны, paidAt уже записан сервисом. Владельцу — в оба канала; ответ OK:
    // повтор вебхука денег не вернёт и брони не восстановит. warn, не error:
    // error ушёл бы владельцу вторым DM через AlertLogger. Если сам сигнал не
    // дошёл (исключение), отвечаем FAIL — Robokassa повторит, повтор оповестит.
    if (e instanceof PaymentAfterCancelError) {
      logger.warn(
        `Booking ${id}: payment received after cancel/expiry (paidAt recorded)`,
      );
      try {
        const { html, subject } = paidAfterCancelAlert(e.booking, e.paidAmount);
        await notify.notifyAdminBoth(html, subject);
      } catch (notifyErr) {
        logger.error(
          `PAID after cancel, booking ${id}: admin alert failed: ${(notifyErr as Error).message}`,
        );
        return `FAIL${invId}`;
      }
      return `OK${invId}`;
    }
    // Остальные ConflictException — бронь уже в статусе, где подтверждать
    // нечего (COMPLETED: поздний повтор вебхука) — ack, чтобы Robokassa
    // перестала слать. Повтор по CONFIRMED сюда не доходит: сервис отвечает ok.
    if (e instanceof ConflictException) {
      logger.warn(`Confirm booking ${id}: ${(e as Error).message}`);
      return `OK${invId}`;
    }
    // Real failure: the client PAID but the booking didn't confirm. Alert loudly
    // and return FAIL so Robokassa retries later.
    logger.error(
      `PAID but confirm failed for booking ${id}: ${(e as Error).message}`,
    );
    await notify.alertAdmin(
      `🚨 <b>Оплата прошла, но бронь #${id} не подтвердилась</b>\n${(e as Error).message}\nПроверьте вручную в админке.`,
    );
    return `FAIL${invId}`;
  }
  return `OK${invId}`;
}
