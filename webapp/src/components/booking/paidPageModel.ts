// Модель экрана возврата с оплаты (/booking/paid). Страница открывается по
// подписанному редиректу SuccessURL, а он приходит раньше (или вместо)
// вебхука ResultURL, который единственный переводит бронь в CONFIRMED. Поэтому
// «Встреча подтверждена» можно говорить только про CONFIRMED (аудит 2026-10-11,
// security#15): HELD — «оплата принята, подтверждаю», COMPLETED — «встреча прошла»
// (ссылка управления из .ics живёт и после сессии), остальное — нейтрально.

/** Ссылка управления записью (календарь, .ics, «Отправить себе»), а не возврат с оплаты:
 *  /booking/manage отдаётся той же страницей, что /booking/paid. */
export const isManageLink = () => window.location.pathname.startsWith('/booking/manage');

export type PaidPhase = 'confirmed' | 'pending' | 'cancelled' | 'completed' | 'unknown';

/** Статус брони (BookingStatus из Prisma) → что показывать. Незнакомый → unknown. */
export function paidPhase(status: string): PaidPhase {
  switch (status) {
    case 'CONFIRMED':
      return 'confirmed';
    case 'HELD':
      return 'pending';
    case 'CANCELLED':
      return 'cancelled';
    case 'COMPLETED':
      return 'completed';
    default:
      return 'unknown';
  }
}

/** Первая пауза опроса брони, пока она HELD; дальше пауза удваивается до потолка. */
export const POLL_INTERVAL_MS = 5_000;
/** Потолок паузы: подтверждение видно не позже чем через 20 с после вебхука. */
export const POLL_MAX_INTERVAL_MS = 20_000;
/** Через сколько перестать ждать вебхук и честно сказать «задерживается». */
export const POLL_LIMIT_MS = 120_000;

/** Пауза перед повтором №attempt (с 0): 5 → 10 → 20 → 20 … с, последний запрос —
 *  ровно на POLL_LIMIT_MS. Девять запросов на визит вместо 24 при паузе 5 с: лимит
 *  by-token — 60 в час с IP, и две оплаты с одного адреса упирались в 429 (аудит 2026-10). */
export function nextPollDelayMs(attempt: number, elapsedMs: number): number {
  const backoff = Math.min(POLL_INTERVAL_MS * 2 ** attempt, POLL_MAX_INTERVAL_MS);
  return Math.max(0, Math.min(backoff, POLL_LIMIT_MS - elapsedMs));
}
