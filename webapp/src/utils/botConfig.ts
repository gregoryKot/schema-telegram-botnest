// Единый источник username Telegram-бота в webapp. Значение — из env
// VITE_BOT_USERNAME (в проде вшивается Dockerfile'ом). Переезд на новый бот =
// смена этой переменной, без правок кода. Дефолта нет: пусто — сборка падает.
const BOT_USERNAME =
  (import.meta.env.VITE_BOT_USERNAME as string | undefined)?.trim() ?? '';

// Username без @ — напр. 'SchemeHappensBot'.
export const botUsername = BOT_USERNAME;
// С @ — для отображения в тексте.
export const botHandle = `@${BOT_USERNAME}`;
// https-ссылка на бота (href кнопок).
export const botUrl = `https://t.me/${BOT_USERNAME}`;
// Без схемы — для plain-text шаринга (Telegram сам оформит ссылку).
export const botShortUrl = `t.me/${BOT_USERNAME}`;

// Ник бота мини-приложения MAX (VITE_MAX_BOT_USERNAME, вшивает Dockerfile).
// Пусто — входа через MAX на странице входа нет: ссылке вести некуда.
export const maxBotUsername =
  (import.meta.env.VITE_MAX_BOT_USERNAME as string | undefined)?.trim() ?? '';
