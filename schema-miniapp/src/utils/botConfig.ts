// Единый источник Telegram-бота в мини-аппе. Значения — из env
// VITE_BOT_USERNAME и VITE_MINIAPP_APP_NAME. ВАЖНО: мини-апп собирается локально
// (его dist коммитится), поэтому env берётся из schema-miniapp/.env на сборке,
// а не из Dockerfile. Парный файл: webapp/src/utils/botConfig.ts (правило №3).
const BOT_USERNAME =
  (import.meta.env.VITE_BOT_USERNAME as string | undefined)?.trim() ||
  'SchemaLabBot';
const MINIAPP_APP_NAME =
  (import.meta.env.VITE_MINIAPP_APP_NAME as string | undefined)?.trim() ||
  'diary';

// С @ — для отображения в тексте.
export const botHandle = `@${BOT_USERNAME}`;
// https-ссылка на бота (href кнопок).
export const botUrl = `https://t.me/${BOT_USERNAME}`;
// Без схемы — для plain-text шаринга (Telegram сам оформит ссылку).
export const botShortUrl = `t.me/${BOT_USERNAME}`;
// t.me deep-link в мини-апп; startapp — необязательный payload приглашения.
export const miniappDeepLink = (startapp?: string): string =>
  `https://t.me/${BOT_USERNAME}/${MINIAPP_APP_NAME}${
    startapp ? `?startapp=${startapp}` : ''
  }`;
