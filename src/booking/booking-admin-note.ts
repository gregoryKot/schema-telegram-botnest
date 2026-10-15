import { escapeHtml } from '../utils/escape-html';

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
