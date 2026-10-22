// Правила самостоятельной отмены записи клиентом. Часы синхронизированы с
// бэкендом (src/booking/booking.config.ts::MIN_CANCEL_LEAD_HOURS, правило №4
// CLAUDE.md — денормализация только с тестом-сверкой) — см.
// cancelPolicy.sync.test.ts, который читает исходник бэкенда и падает при
// рассинхроне.
export const CANCEL_LEAD_HOURS = 24;

export const CANCEL_SUPPORT_LINK = 'https://t.me/kotlarewski';
export const CANCEL_SUPPORT_HANDLE = '@kotlarewski';

/** Онлайн-отмена закрыта — до встречи осталось меньше CANCEL_LEAD_HOURS. */
export function isPastCancelWindow(startsAtIso: string, now = Date.now()): boolean {
  return new Date(startsAtIso).getTime() - now < CANCEL_LEAD_HOURS * 3_600_000;
}
