import { escapeHtml } from '../utils/escape-html';
import type { OwnerAlert } from '../utils/owner-card';
import { formatPrice } from './price-region';
import { subjectFromTitle } from './booking-notify.format';
import { bookingNotice, type OwnerBooking } from './booking-owner-card';

// Пометки админу в уведомлениях о брони. Клиенту они не показываются: ответ
// публичной ручки записи не должен выдавать, кто из контактов уже клиент
// (security#19, аудит 2026-10), поэтому различие живёт только здесь.

/** «Повторная встреча» отмечена, а контакта среди клиентов нет. */
export const RETURNING_NOT_FOUND_NOTE =
  'клиент указал повторную встречу, контакт не найден среди клиентов';

const AWAITING_PAYMENT =
  '⏳ <b>Бронь ожидает оплаты</b> (слот зарезервирован на 15 мин)';

/** Заголовок «ожидает оплаты»; с пометкой — второй строкой. */
export function awaitingPaymentTitle(note?: string): string {
  return note
    ? `${AWAITING_PAYMENT}\n⚠️ ${escapeHtml(note)}`
    : AWAITING_PAYMENT;
}

/**
 * Заголовок «запись отменена». Оплаченную бронь (`paidAt` — деньги пришли
 * вебхуком Robokassa, только рубли) отменяют так же, как неоплаченную, а
 * владельцу нужно вернуть деньги: без пометки DM и письмо выглядели одинаково
 * (аудит 2026-11, R9). Заголовок же становится темой письма — пометка видна
 * в обоих каналах.
 */
export function cancelledTitle(b: {
  paidAt?: Date | null;
  amount?: number | null;
}): string {
  if (b.paidAt == null) return '❌ <b>Запись отменена</b>';
  const sum =
    b.amount != null
      ? formatPrice(b.amount, 'RUB')
      : 'сумму сверьте в Robokassa';
  return `❌ <b>Запись отменена — оплачена, нужен возврат, ${sum}</b>`;
}

/** Что делать с деньгами отменённой оплаченной брони — строкой под карточкой. */
export const REFUND_HINT =
  'Деньги пришли через Robokassa: верните их клиенту и аннулируйте чек в «Моём налоге».';

/** Уведомление об отмене для обоих каналов: карточка брони и тема письма. */
export function cancelledNotice(b: OwnerBooking): OwnerAlert {
  const title = cancelledTitle(b);
  const tail = b.paidAt != null ? ['', REFUND_HINT] : [];
  return {
    html: bookingNotice(title, b, tail),
    subject: subjectFromTitle(title),
  };
}
