// Сессия мини-аппа: initData используется ОДИН раз, дальше живём на Bearer.
//
// Инцидент 2026-07-29: Telegram выдаёт initData в момент открытия мини-аппа и
// больше не обновляет её, пока webview жив. Свернул приложение, открыл через
// час — уходит та же строка с `auth_date` часовой давности, и каждый запрос
// получает 401. Приложение при этом молча не работало, а бэкенд на каждый
// такой 401 слал админу «suspicious_initdata».
//
// Лечение: пока initData свежая, меняем её на пару access/refresh (тем же
// эндпоинтом, что у сайта), дальше запросы ходят с Bearer. Access живёт 15
// минут и продлевается refresh-кукой (30 дней). Сам access держим только в
// памяти: переживать перезапуск webview — работа куки, а не localStorage.
import { getHost } from '../../shared/src/host';
import { BASE } from './utils/apiBase';

const EXPIRY_SKEW_MS = 60_000; // обновляемся заранее, с запасом на расхождение часов
const DEAD_SESSION_COOLDOWN_MS = 30_000; // не долбим сервер, если чинить нечем

export const SESSION_EXPIRED_EVENT = 'session-expired';
/** AppErrorScreen различает ветки по «401». Название мессенджера он берёт у
 *  хоста — та же строка показывается и в MAX, поэтому «Telegram» тут нет. */
export const SESSION_EXPIRED_ERROR = 'Не удалось получить доступ (401)';

let accessToken: string | null = null;
let accessExpiresAt = 0;
// Один общий промис на все параллельные попытки: refresh-токен ротируется при
// каждом обмене, и два одновременных запроса выглядели бы как кража токена —
// сервер отозвал бы всю семью и разлогинил пользователя.
let inFlight: Promise<boolean> | null = null;
let bootstrapped: Promise<boolean> | null = null;
let deadUntil = 0;

function tokenIsFresh(now = Date.now()): boolean {
  return !!accessToken && now + EXPIRY_SKEW_MS < accessExpiresAt;
}

function remember(token: string, expiresIn: number): void {
  accessToken = token;
  accessExpiresAt = Date.now() + expiresIn * 1000;
  deadUntil = 0;
}

export function clearSession(): void {
  accessToken = null;
  accessExpiresAt = 0;
  inFlight = null;
  bootstrapped = null;
  deadUntil = 0;
}

/** Заголовки запроса: Bearer, если сессия жива, иначе (первый вход) initData. */
export function authHeaders(): Record<string, string> {
  return {
    ...(tokenIsFresh()
      ? { Authorization: `Bearer ${accessToken}` }
      : getHost().authHeaders()),
    'Content-Type': 'application/json',
  };
}

async function postAuth(path: string, body?: unknown): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      credentials: 'include', // httpOnly refresh-кука
      headers: {
        'Content-Type': 'application/json',
        'x-requested-with': 'miniapp', // CSRF-заголовок, как у сайта
      },
      body: JSON.stringify(body ?? {}),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as {
      accessToken: string;
      expiresIn: number;
    };
    if (!data?.accessToken) return false;
    remember(data.accessToken, data.expiresIn);
    return true;
  } catch {
    return false;
  }
}

/**
 * Перевыпуск сессии. Сначала refresh-кука (работает и когда initData давно
 * протухла), затем обмен initData — им лечится самый первый вход, когда куки
 * ещё нет. Параллельные вызовы разделяют один промис.
 */
export function renewSession(): Promise<boolean> {
  if (tokenIsFresh()) return Promise.resolve(true);
  if (Date.now() < deadUntil) return Promise.resolve(false);
  if (inFlight) return inFlight;
  inFlight = (async () => {
    if (await postAuth('/api/auth/refresh')) return true;
    const exchange = getHost().sessionExchange();
    if (exchange && (await postAuth(exchange.path, exchange.body))) return true;
    // Ни куки, ни свежей initData: чинить нечем — пользователю надо переоткрыть
    // мини-апп, чтобы Telegram выдал новую подпись.
    deadUntil = Date.now() + DEAD_SESSION_COOLDOWN_MS;
    return false;
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/**
 * Стартовый обмен — один раз за загрузку приложения, фоном. Это и есть лечение
 * инцидента: сессию надо выпустить, ПОКА initData свежая. Запросы его не ждут
 * (первые и так уходят с валидной initData), но через час свернутое приложение
 * найдёт живую refresh-куку вместо просроченной подписи.
 */
export function ensureSession(): Promise<boolean> {
  bootstrapped ??= renewSession();
  return bootstrapped;
}

/**
 * Принять сессию от привязки к другому аккаунту (device-link). Прежний
 * стартовый обмен надо забыть: иначе первый же перевыпуск вернул бы человека
 * в пустой аккаунт мессенджера.
 */
export function adoptSession(token: string, expiresIn: number): void {
  bootstrapped = Promise.resolve(true);
  inFlight = null;
  remember(token, expiresIn);
}

/** Сессию восстановить не удалось — экран обязан сказать это пользователю. */
export function markSessionExpired(): void {
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
}
