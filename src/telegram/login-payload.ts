// Разбор `/start login_<КОД>` — ссылки, которой приложение уводит человека
// подтверждать вход в Telegram.
//
// Отдельным файлом по образцу start-source.ts: `/start` в telegram.service.ts
// и так на потолке размера, а чистый разбор удобнее держать под тестом.
//
// Совпадение подстроки — не проверка имени (правило №14 CLAUDE.md): проверяем
// префикс целиком и форму кода целиком, иначе `xlogin_ABC` или `login_` с
// мусором доехали бы до похода в БД.
const PREFIX = 'login_';

/** Код такой же, как выдаёт LoginTicketService: 8 символов без 0/O/1/I/L. */
const CODE_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/;

/** Ссылка, по которой человек уходит подтверждать вход. */
export function loginDeepLink(botUsername: string, code: string): string {
  return `https://t.me/${botUsername}?start=${PREFIX}${code}`;
}

/** true — payload адресован входу (даже если код внутри негодный). */
export function isLoginPayload(payload: string | undefined): boolean {
  return typeof payload === 'string' && payload.startsWith(PREFIX);
}

/**
 * Код из payload или null, если это не вход либо код не той формы.
 * Регистр приводим к верхнему: клиенты мессенджеров иногда «улучшают» ссылку.
 */
export function parseLoginCode(payload: string | undefined): string | null {
  if (!isLoginPayload(payload)) return null;
  const code = payload!.slice(PREFIX.length).trim().toUpperCase();
  return CODE_RE.test(code) ? code : null;
}

/**
 * Код для показа человеку: `K7M2-QX94`. Разбитый пополам код глазами
 * сверяется заметно легче, а сверка — единственное, что стоит между честным
 * входом и присланной кем-то ссылкой.
 *
 * Зеркало для фронтендов — shared/src/auth/loginTicketCode.ts (бэкенд из
 * shared не импортирует, как quiz-logic.ts и telemetry-url.util.ts). Формат
 * обязан совпадать: человек сверяет строку в чате со строкой на экране.
 */
export function formatUserCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}
