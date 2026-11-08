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
export const CABINET_URL = `${APP_URL}/today`;
export const CABINET_HELP_URL = `${APP_URL}/practice`;
// Ссылки запуска кабинета: кнопка web_app открывает адрес как есть, сайт разбирает
// `?startapp=` (shared/src/host/startParam.ts) — «Задания», задание по id, тест на схемы.
// Уведомление о задании вело на «Сегодня», где заданий нет (аудит 2026-11, U2).
export const CABINET_YSQ_URL = `${CABINET_URL}?startapp=ysq`;
export const cabinetTasksUrl = (taskId?: number): string =>
  `${CABINET_URL}?startapp=${taskId ? `tasks_${taskId}` : 'tasks'}`;

/** Меню команд бота (setMyCommands). Единый список — правится здесь. */
export const BOT_COMMANDS = [
  { command: 'start', description: 'Открыть «Всё по схеме» 🧠' },
  { command: 'tests', description: 'Мини-тесты на 2 минуты 🎲' },
  { command: 'settings', description: 'Настройки уведомлений ⚙️' },
  { command: 'donate', description: 'Поддержать проект 💛' },
  { command: 'about', description: 'О приложении и авторе ℹ️' },
];

// Список поясов — src/notification/notify-timezones.ts (один на бота, сайт и мини-апп).
export { VALID_TIMEZONES } from '../notification/notify-timezones';
export const ERROR_RETRY = 'Не получилось. Попробовать ещё раз.';
