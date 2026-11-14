// Кнопки финала (решение 2 в #1087): главная — «попробовать в приложении»,
// тише — бот и запись к терапевту. meta.to режет src/analytics/game-cta.constants.ts.
import { trackEvent } from './analytics';

export type CtaPlace = 'act1' | 'cabinet' | 'ending';
export type CtaTarget = 'app' | 'booking' | 'bot';

// Лендинг ловит ?from=game и шлёт game_app_arrive (webapp/src/pages/landing/useGameArrival.ts).
export const APP_URL = 'https://schemehappens.ru/?from=game';
// Тот же адрес, что BOOKING_URL бота (src/telegram/telegram.constants.ts), сверка — его спека.
export const BOOKING_URL = 'https://kotlarewski.gr/#booking';
// src_game бот пишет в signup_source → «Из игры» в /stats (src/telegram/start-source.ts);
// ник — VITE_BOT_USERNAME из Dockerfile, сверка — src/test-support/gates/bot-username-sources.spec.ts.
export const BOT_URL = 'https://t.me/SchemeHappensBot?start=src_game';

const URLS: Record<CtaTarget, string> = { app: APP_URL, booking: BOOKING_URL, bot: BOT_URL };

export function openCta(from: CtaPlace, to: CtaTarget): void {
  trackEvent('game_cta_click', { from, to });
  window.open(URLS[to], '_blank');
}
