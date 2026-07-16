// Единый источник Telegram-бота приложения. Username берётся из env
// VITE_BOT_USERNAME (в проде webapp — из Dockerfile). Переезд на новый бот =
// смена одной переменной, без правок кода. Дефолт сохраняет текущее поведение.
//
// Парный файл: schema-miniapp/src/utils/botConfig.ts — правится в паре
// (CLAUDE.md, правило №3). Отличие мини-аппа: он собирается локально, поэтому
// VITE_BOT_USERNAME читается из его .env при сборке, а не из Dockerfile.
const BOT_USERNAME =
  (import.meta.env.VITE_BOT_USERNAME as string | undefined)?.trim() ||
  'SchemaLabBot';

/** Короткое имя мини-аппа в deep-link t.me/<bot>/<app>. */
const MINIAPP_APP_NAME =
  (import.meta.env.VITE_MINIAPP_APP_NAME as string | undefined)?.trim() ||
  'diary';

/** Username без @ — напр. 'SchemaLabBot'. */
export const botUsername = BOT_USERNAME;
/** С @ — для отображения в тексте. */
export const botHandle = `@${BOT_USERNAME}`;
/** https-ссылка на бота (href кнопок). */
export const botUrl = `https://t.me/${BOT_USERNAME}`;
/** Без схемы — для plain-text шаринга (Telegram сам оформит ссылку). */
export const botShortUrl = `t.me/${BOT_USERNAME}`;
/** t.me deep-link в мини-апп; startapp — необязательный payload. */
export const miniappDeepLink = (startapp?: string): string =>
  `https://t.me/${BOT_USERNAME}/${MINIAPP_APP_NAME}${
    startapp ? `?startapp=${startapp}` : ''
  }`;
