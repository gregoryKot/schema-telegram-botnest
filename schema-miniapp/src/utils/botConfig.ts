// Единый источник Telegram-бота в мини-аппе. Значения — из env
// VITE_BOT_USERNAME (дефолта нет: пусто — сборка падает) и VITE_MINIAPP_APP_NAME.
// ВАЖНО: мини-апп собирается локально (dist коммитится), env берётся из
// schema-miniapp/.env* на сборке, не из Dockerfile. Пара: webapp/src/utils/botConfig.ts.
const BOT_USERNAME =
  (import.meta.env.VITE_BOT_USERNAME as string | undefined)?.trim() ?? '';
const MINIAPP_APP_NAME =
  (import.meta.env.VITE_MINIAPP_APP_NAME as string | undefined)?.trim() ||
  'diary';

// Username без @ — напр. 'SchemeHappensBot'; из него строится ссылка входа
// `t.me/<bot>?start=login_<КОД>` (shared/src/auth/useLoginTicket).
export const botUsername = BOT_USERNAME;
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
