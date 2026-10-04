/**
 * id пользователя в ответах API. Telegram-аккаунты (~1e9–1e10) приходят
 * числом, веб-аккаунты (Google/VK/MAX/почта) лежат в [1e18, 9e18) — выше 2^53,
 * и сервер отдаёт их десятичной СТРОКОЙ (src/utils/bigint-json.ts). Не
 * приводить к Number и не сравнивать через `===` с числом: см. utils/sameId.
 */
export type UserId = number | string;
