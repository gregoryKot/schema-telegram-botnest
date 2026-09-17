// Разбор `/start link_<КОД>` — ссылки, которой САЙТ уводит человека
// подтверждать объединение аккаунтов в Telegram.
//
// Префикс отдельный от входа намеренно. Код входа и код привязки
// подтверждаются разными путями (approveLogin отказывает при intent !== 'login',
// approve — при intent !== 'link'), и показать человеку карточку не того
// намерения значит соврать ему о том, что он подтверждает.
import { hasPrefix, parseTicketCode } from './ticket-code';

const PREFIX = 'link_';

/** Ссылка, по которой человек уходит подтверждать объединение аккаунтов. */
export function linkDeepLink(botUsername: string, code: string): string {
  return `https://t.me/${botUsername}?start=${PREFIX}${code}`;
}

/** true — payload адресован привязке (даже если код внутри негодный). */
export function isLinkPayload(payload: string | undefined): boolean {
  return hasPrefix(payload, PREFIX);
}

/** Код из payload или null, если это не привязка либо код не той формы. */
export function parseLinkCode(payload: string | undefined): string | null {
  return parseTicketCode(payload, PREFIX);
}
