// Разбор кода из `/start <префикс><КОД>`. Движок один на оба намерения: у
// входа префикс `login_`, у привязки аккаунта — `link_`, а форма кода и правила
// разбора совпадают. Вторая копия регулярки означала бы, что правку внесут в
// одну ветку, а вторая тихо останется старой.
//
// Совпадение подстроки — не проверка имени (правило №14 CLAUDE.md): префикс
// сверяется целиком, форма кода — целиком. Иначе `xlogin_ABC` или `login_` с
// мусором доехали бы до похода в БД.

/** Код такой же, как выдаёт LoginTicketService: 8 символов без 0/O/1/I/L. */
export const CODE_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/;

/** true — payload адресован этому намерению (даже если код внутри негодный). */
export function hasPrefix(
  payload: string | undefined,
  prefix: string,
): boolean {
  return typeof payload === 'string' && payload.startsWith(prefix);
}

/**
 * Код из payload или null, если это чужое намерение либо код не той формы.
 * Регистр приводим к верхнему: клиенты мессенджеров иногда «улучшают» ссылку.
 */
export function parseTicketCode(
  payload: string | undefined,
  prefix: string,
): string | null {
  if (!hasPrefix(payload, prefix)) return null;
  const code = payload!.slice(prefix.length).trim().toUpperCase();
  return CODE_RE.test(code) ? code : null;
}

/**
 * Код для показа человеку: `K7M2-QX94`. Разбитый пополам код глазами
 * сверяется заметно легче, а сверка — единственное, что стоит между честным
 * действием и присланной кем-то ссылкой.
 *
 * Зеркало для фронтендов — shared/src/auth/loginTicketCode.ts (бэкенд из
 * shared не импортирует). Формат обязан совпадать: человек сверяет строку в
 * чате со строкой на экране.
 */
export function formatUserCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}
