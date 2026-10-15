// Модель экрана возврата с оплаты (/booking/paid). Страница открывается по
// подписанному редиректу SuccessURL, а он приходит раньше (или вместо)
// вебхука ResultURL, который единственный переводит бронь в CONFIRMED. Поэтому
// «Встреча подтверждена» можно говорить только про CONFIRMED (аудит 2026-10-11,
// security#15): HELD — «оплата принята, подтверждаем», остальное — нейтрально.

export type PaidPhase = 'confirmed' | 'pending' | 'cancelled' | 'unknown';

/** Статус брони (BookingStatus из Prisma) → что показывать. Незнакомый → unknown. */
export function paidPhase(status: string): PaidPhase {
  switch (status) {
    case 'CONFIRMED':
      return 'confirmed';
    case 'HELD':
      return 'pending';
    case 'CANCELLED':
      return 'cancelled';
    default:
      return 'unknown';
  }
}

/** Как часто переспрашивать бронь, пока она HELD. 5 с × 2 мин = 24 запроса на визит
 *  (лимит ручки by-token — 60 в час с IP). */
export const POLL_INTERVAL_MS = 5_000;
/** Через сколько перестать ждать вебхук и честно сказать «задерживается». */
export const POLL_LIMIT_MS = 120_000;
