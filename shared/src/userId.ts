/**
 * id пользователя в ответах API. Telegram-аккаунты (~1e9–1e10) приходят
 * числом, веб-аккаунты (Google/VK/MAX/почта) лежат в [1e15, 9e15)
 * (src/auth/user-id-range.ts); id выше 2^53 сервер отдаёт десятичной СТРОКОЙ
 * (src/utils/bigint-json.ts). Не приводить к Number и не сравнивать через
 * `===` с числом: см. utils/sameId.
 */
export type UserId = number | string;
