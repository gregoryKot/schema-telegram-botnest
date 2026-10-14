import { bookingCardText, subjectFromTitle } from './booking-notify.format';
import type { PlainBooking } from './booking-notify.service';

/**
 * Текст сигнала владельцу: деньги по ResultURL пришли, а бронь уже отменена
 * или истекла (клиент заплатил по старой ссылке; чек в «Моём налоге» выбит,
 * записи нет). Чистый форматтер; отправка — `notifyAdminBoth` (оба канала,
 * это деньги). Простыми словами: что случилось и что делать.
 */
export function paidAfterCancelAlert(
  b: PlainBooking,
  paidAmount?: number,
): { html: string; subject: string } {
  const title = `💸 <b>Деньги получены, а брони #${b.id} нет</b>`;
  const sum = paidAmount != null ? `${paidAmount} ₽` : 'сумма не указана';
  const html = [
    bookingCardText(title, b),
    `💰 Оплачено: ${sum}`,
    '',
    'Бронь отменена или истекла до оплаты. Верните деньги клиенту (и аннулируйте чек в «Моём налоге») либо запишите его заново вручную: слот мог уже уйти другому.',
  ].join('\n');
  return { html, subject: subjectFromTitle(title) };
}
