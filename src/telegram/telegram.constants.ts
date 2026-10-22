import { normalizeBaseUrl } from '../utils/url';

export const TELEGRAF_BOT = 'TELEGRAF_BOT';
export const CHANNEL = '@SchemeHappens';
export const BOOKING_URL = 'https://kotlarewski.gr/#booking';
/** App base URL for support links; normalised so a bare domain in env (no scheme) still works. */
export const APP_URL = normalizeBaseUrl(
  process.env.APP_URL,
  'https://schemehappens.ru',
);
export const SUBSCRIBE_URL = `${APP_URL}/subscribe`;
export const DONATE_URL = `${APP_URL}/donate`;
// Дефолтов нет: 'SchemaLabBot' и vercel-адрес вели в старого бота (см. miniapp-link.ts).
export const BOT_USERNAME = (process.env.BOT_USERNAME ?? '')
  .trim()
  .replace(/^@/, '');
export const MINIAPP_APP_NAME = process.env.MINIAPP_APP_NAME ?? 'diary';
// Кнопки и меню бота ведут прямо в кабинет сайта (этап 5 единой версии): без
// перехода через /app/, чтобы основной вход не зависел от переноса фрагмента
// #tgWebAppData через редирект. Явный MINIAPP_URL в env сильнее (откат).
export const MINIAPP_URL =
  process.env.MINIAPP_URL?.trim() || `${APP_URL}/today`;

/** Меню команд бота (setMyCommands). Единый список — правится здесь. */
export const BOT_COMMANDS = [
  { command: 'start', description: 'Открыть «Всё по схеме» 🧠' },
  { command: 'tests', description: 'Мини-тесты на 2 минуты 🎲' },
  { command: 'settings', description: 'Настройки уведомлений ⚙️' },
  { command: 'donate', description: 'Поддержать проект 💛' },
  { command: 'about', description: 'О приложении и авторе ℹ️' },
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
export const ERROR_RETRY = 'Не получилось. Попробовать ещё раз.';
