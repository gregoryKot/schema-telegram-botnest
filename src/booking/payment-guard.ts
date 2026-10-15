import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { SessionType } from '@prisma/client';
import type { BookingNotifyService } from './booking-notify.service';
import { lostLeadAlertText, type LostLead } from './booking-notify.format';
import type { RobokassaService } from './robokassa.service';

// Что делать платным путям, когда Robokassa не настроена (аудит 2026-10-11).
// Раньше `enabled=false` везде значило «dev: подтвердить без денег», и это
// работало в проде тоже: сняли ROBOKASSA_* — платная сессия подтверждалась,
// донат помечался оплаченным, подписка включалась, а денег не было ни разу.
//
//   live   — Robokassa настроена, ведём человека на оплату;
//   dev    — не прод и не настроена: автоподтверждение для разработки и CI;
//   refuse — прод и не настроена: честный отказ 503, деньги не обещаем.
//
// NODE_ENV читается в момент вызова, а не при старте: e2e переключает
// окружение на один запрос и не перезапускает приложение.
export type PaymentMode = 'live' | 'dev' | 'refuse';
export type PaymentKind = 'booking' | 'donation' | 'subscription';

const logger = new Logger('PaymentGuard');

export function paymentMode(
  robokassa: Pick<RobokassaService, 'enabled'>,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): PaymentMode {
  if (robokassa.enabled) return 'live';
  return nodeEnv === 'production' ? 'refuse' : 'dev';
}

/**
 * Отказ платного пути. Текст лога стабильный и без id: AlertLogger шлёт
 * владельцу DM с троттлингом по тексту (60 с) и общим бюджетом в минуту —
 * поток отказов не превращается в поток сообщений.
 */
export function refusePayment(kind: PaymentKind): never {
  logger.error(`Robokassa not configured in production: ${kind} refused`);
  throw new ServiceUnavailableException('PAYMENT_UNAVAILABLE');
}

/** Прод без Robokassa — отказ; иначе ничего не делает (live/dev идут дальше). */
export function assertPaymentAvailable(
  robokassa: Pick<RobokassaService, 'enabled'>,
  kind: PaymentKind,
): void {
  if (paymentMode(robokassa) === 'refuse') refusePayment(kind);
}

/**
 * Платная запись при ненастроенной оплате в проде: отказ ДО создания брони
 * (иначе HELD-строка держала бы слот 15 минут, а владельцу пришло бы
 * «бронь истекла без оплаты»). Имя и контакт человека не теряются: заявка
 * уходит владельцу лидом в оба канала (правило №18). Бесплатное знакомство
 * не затрагивается.
 */
export async function assertBookingPayable(
  robokassa: Pick<RobokassaService, 'enabled'>,
  notify: Pick<BookingNotifyService, 'notifyAdminBoth'>,
  lead: LostLead,
): Promise<void> {
  if (lead.type === SessionType.INTRO_15) return;
  if (paymentMode(robokassa) !== 'refuse') return;
  await notify.notifyAdminBoth(
    lostLeadAlertText(lead, 'оплата не настроена'),
    '🚨 Заявка на запись не сохранилась',
  );
  refusePayment('booking');
}
