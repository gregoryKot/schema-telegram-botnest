// Адрес карточки клиента в кабинете терапевта: /cabinet/<код>. До 2026-11 в
// адресе стоял telegramId, а у офлайн-клиента это -TherapyRelation.id: при
// подключении карточки к аккаунту клиента число менялось, и сохранённая
// ссылка вела в «Клиент не найден». Код (`urlCode` из GET /api/therapy/clients)
// постоянный и переезжает вместе с карточкой. Старые числовые ссылки
// по-прежнему открываются, а адрес меняется на код (canonicalClientPath).
// За частью клиента может идти вкладка карточки (/cabinet/<код>/tasks):
// здесь она переносится как есть, слаги знает webapp (therapist/clientTabRoute).
import type { UserId } from '../userId';
import { parseRouteUserId, sameId } from './sameId';

/** 8 строчных латинских букв без i, l, o: цифр нет, с числовым id не спутать. */
export const CLIENT_CODE_RE = /^[a-hjkmnp-s]{8}$/;

export interface ClientRefSource {
  telegramId: UserId;
  urlCode?: string | null;
}

/** /cabinet/<ref> и /cabinet/<ref>/<вкладка>: [1] — ref, [2] — «/вкладка» или нет. */
const CARD_PATH_RE = /^\/cabinet\/([^/]+)(\/[^/]+)?$/;

/** Часть адреса карточки: код, а без кода (старый сервер, старый кэш) — id. */
export function clientRef(c: ClientRefSource): string {
  return c.urlCode && CLIENT_CODE_RE.test(c.urlCode)
    ? c.urlCode
    : String(c.telegramId);
}

/** `:clientId` из адреса → код или числовой id (старые ссылки); мусор и пустое — null. */
export function parseClientRef(raw: string | undefined | null): string | null {
  return raw && CLIENT_CODE_RE.test(raw) ? raw : parseRouteUserId(raw);
}

/** Клиент ли это из адреса: код сверяется с urlCode, числовой ref — с id (строкой). */
export function matchesClientRef(
  c: ClientRefSource,
  ref: string | undefined | null,
): boolean {
  if (!ref) return false;
  if (CLIENT_CODE_RE.test(ref)) return c.urlCode === ref;
  return parseRouteUserId(ref) != null && sameId(c.telegramId, ref);
}

/** Клиент по части адреса; не нашёлся — undefined. */
export function findClientByRef<T extends ClientRefSource>(
  clients: readonly T[],
  ref: string | undefined | null,
): T | undefined {
  return clients.find((c) => matchesClientRef(c, ref));
}

/** Адрес карточки клиента с этим id: с кодом, если клиент есть в списке и код у него есть. */
export function clientPath(
  id: UserId,
  clients: readonly ClientRefSource[],
): string {
  const c = clients.find((x) => sameId(x.telegramId, id));
  return '/cabinet/' + (c ? clientRef(c) : String(id));
}

/**
 * Открыта ли уже карточка клиента с этим id (на любой вкладке): адрес с его
 * кодом или старый числовой (его сменит canonicalClientPath). Код, которого список ещё не
 * знает, тоже свой: карточка по ссылке открывается раньше, чем догружается
 * список кабинета, и прямой вход иначе пушил бы /cabinet/<id> поверх кода.
 */
export function isClientCardOpen(
  pathname: string,
  id: UserId,
  clients: readonly ClientRefSource[],
): boolean {
  const ref = pathname.match(CARD_PATH_RE)?.[1];
  if (ref === String(id)) return true;
  if (!ref || !CLIENT_CODE_RE.test(ref)) return false;
  const c = findClientByRef(clients, ref);
  return !c || sameId(c.telegramId, id);
}

/**
 * Старый числовой адрес карточки → адрес с кодом и той же вкладкой (для
 * замены без записи в историю). null — менять нечего: уже код, не карточка,
 * клиента нет в списке или у него нет кода.
 */
export function canonicalClientPath(
  pathname: string,
  clients: readonly ClientRefSource[],
): string | null {
  const m = pathname.match(CARD_PATH_RE);
  const id = parseRouteUserId(m?.[1]);
  if (id == null) return null;
  const to = clientPath(id, clients) + (m?.[2] ?? '');
  return to === pathname ? null : to;
}
