// Разбор `/start link_<КОД>` — ссылки, которой САЙТ уводит человека
// подтверждать объединение аккаунтов в Telegram.
//
// Бот подтверждает ТОЛЬКО привязку: вход на сайт через Telegram убран в
// 2026-11 (login-payload.ts), билет входа боту не виден вовсе
// (LoginTicketService.forConfirm), а approve отказывает при intent !== 'link' —
// показать карточку не того намерения значит соврать о том, что подтверждают.
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
