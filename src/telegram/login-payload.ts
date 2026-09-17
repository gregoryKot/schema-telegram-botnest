// Разбор `/start login_<КОД>` — ссылки, которой приложение уводит человека
// подтверждать вход в Telegram. Движок разбора общий с привязкой аккаунта
// (ticket-code.ts), здесь остаётся только префикс и его обёртки.
import { hasPrefix, parseTicketCode } from './ticket-code';

export { formatUserCode } from './ticket-code';

const PREFIX = 'login_';

/** Ссылка, по которой человек уходит подтверждать вход. */
export function loginDeepLink(botUsername: string, code: string): string {
  return `https://t.me/${botUsername}?start=${PREFIX}${code}`;
}

/** true — payload адресован входу (даже если код внутри негодный). */
export function isLoginPayload(payload: string | undefined): boolean {
  return hasPrefix(payload, PREFIX);
}

/** Код из payload или null, если это не вход либо код не той формы. */
export function parseLoginCode(payload: string | undefined): string | null {
  return parseTicketCode(payload, PREFIX);
}
