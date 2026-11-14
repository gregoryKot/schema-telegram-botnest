import { subjectFromTitle } from './booking-notify.format';
import { bookingNotice } from './booking-owner-card';
import type { PlainBooking } from './booking-notify.service';
import type { OwnerAlert } from '../utils/owner-card';

/**
 * Сигнал владельцу: деньги по ResultURL пришли, а бронь уже отменена или
 * истекла (оплата по старой ссылке; чек выбит, записи нет). Отправка —
 * `notifyAdminBoth`: Telegram без данных клиента, письмо полное.
 */
export function paidAfterCancelAlert(
  b: PlainBooking,
  paidAmount?: number,
): OwnerAlert {
  const title = `💸 <b>Деньги получены, а брони #${b.id} нет</b>`;
  const sum = paidAmount != null ? `${paidAmount} ₽` : 'сумма не указана';
  const html = bookingNotice(title, b, [
    `💰 Оплачено: ${sum}`,
    '',
    'Бронь отменена или истекла до оплаты. Верните деньги клиенту (и аннулируйте чек в «Моём налоге») либо запишите его заново вручную: слот мог уже уйти другому.',
  ]);
  return { html, subject: subjectFromTitle(title) };
}
