import { Markup } from 'telegraf';
import {
  BOOKING_URL,
  MINIAPP_URL,
  DONATE_URL,
} from '../telegram/telegram.constants';

// Кнопки уведомлений — общие для core- и activity-шаблонов.
// Вынесено из notification.templates.ts (правило №10).
export const openDiaryButton = Markup.button.webApp(
  '📱 Открыть «Всё по схеме»',
  MINIAPP_URL,
);
export const bookingButton = Markup.button.url(
  '📝 Записаться на сессию',
  BOOKING_URL,
);
export const donateButton = Markup.button.url(
  '💛 Поддержать проект',
  DONATE_URL,
);

export const snoozeButton = Markup.button.callback(
  '⏰ Через час',
  'snooze_reminder',
);
export const skipTodayButton = Markup.button.callback(
  'Сегодня не могу',
  'notify:skip',
);
export const pauseButton = Markup.button.callback('⏸ Пауза', 'notify:pause');
export const slowerButton = Markup.button.callback('🔕 Реже', 'notify:slower');
