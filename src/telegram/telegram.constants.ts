import { normalizeBaseUrl } from '../utils/url';

export const TELEGRAF_BOT = 'TELEGRAF_BOT';
export const CHANNEL = '@SchemeHappens';
export const BOOKING_URL = 'https://kotlarewski.gr/#booking';
/** App base URL for support links (donate / subscribe). Normalised so a bare
 * domain in env (no scheme) still produces valid Telegram button URLs. */
export const APP_URL = normalizeBaseUrl(
  process.env.APP_URL,
  'https://schemehappens.ru',
);
export const SUBSCRIBE_URL = `${APP_URL}/subscribe`;
export const DONATE_URL = `${APP_URL}/donate`;
export const BOT_USERNAME = process.env.BOT_USERNAME ?? 'SchemaLabBot';
export const MINIAPP_APP_NAME = process.env.MINIAPP_APP_NAME ?? 'diary';
/** Base URL for webApp buttons (can be Vercel or custom domain) */
export const MINIAPP_URL =
  process.env.MINIAPP_URL ?? 'https://schema-miniapp.vercel.app';
/** t.me deep link — use for shareable invite links so Telegram opens the miniapp correctly */
export const MINIAPP_TGLINK = `https://t.me/${BOT_USERNAME}/${MINIAPP_APP_NAME}`;
export const DIARIES_URL = `${MINIAPP_URL}?section=diaries`;

/** Меню команд бота (setMyCommands). Единый список — правится здесь. */
export const BOT_COMMANDS = [
  { command: 'start', description: 'Открыть «Всё по схеме»' },
  { command: 'tests', description: 'Мини-тесты на 2 минуты 🎲' },
  { command: 'settings', description: 'Настройки уведомлений' },
  { command: 'donate', description: 'Поддержать проект 💛' },
  { command: 'about', description: 'О приложении и авторе' },
];

export const VALID_TIMEZONES = [
  'America/Los_Angeles',
  'America/New_York',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Kyiv',
  'Asia/Jerusalem',
  'Europe/Moscow',
  'Asia/Dubai',
  'Asia/Tashkent',
  'Asia/Almaty',
  'Asia/Shanghai',
];
