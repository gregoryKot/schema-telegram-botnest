// Единый источник username Telegram-бота в webapp. Значение — из env
// VITE_BOT_USERNAME (в проде вшивается Dockerfile'ом). Переезд на новый бот =
// смена этой переменной, без правок кода. Дефолт сохраняет текущее поведение.
// Парный файл: schema-miniapp/src/utils/botConfig.ts (CLAUDE.md, правило №3);
// у мини-аппа свой набор экспортов — общий пакет отложен до «волны 2».
const BOT_USERNAME =
  (import.meta.env.VITE_BOT_USERNAME as string | undefined)?.trim() ||
  'SchemaLabBot';

// Username без @ — напр. 'SchemaLabBot'.
export const botUsername = BOT_USERNAME;
// С @ — для отображения в тексте.
export const botHandle = `@${BOT_USERNAME}`;
// https-ссылка на бота (href кнопок).
export const botUrl = `https://t.me/${BOT_USERNAME}`;
// Без схемы — для plain-text шаринга (Telegram сам оформит ссылку).
export const botShortUrl = `t.me/${BOT_USERNAME}`;
