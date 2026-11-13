// Кнопки финала (решение 2 в #1087): главная — «попробовать в приложении»,
// вторая, тише — запись к терапевту. meta.to режет src/analytics/game-cta.constants.ts.
import { trackEvent } from './analytics';

export type CtaPlace = 'act1' | 'cabinet' | 'ending';
export type CtaTarget = 'app' | 'booking';

// Лендинг ловит ?from=game и шлёт game_app_arrive (webapp/src/pages/landing/useGameArrival.ts).
export const APP_URL = 'https://schemehappens.ru/?from=game';
// Тот же адрес, что BOOKING_URL бота (src/telegram/telegram.constants.ts), сверка — его спека.
export const BOOKING_URL = 'https://kotlarewski.gr/#booking';

export function openCta(from: CtaPlace, to: CtaTarget): void {
  trackEvent('game_cta_click', { from, to });
  window.open(to === 'app' ? APP_URL : BOOKING_URL, '_blank');
}
