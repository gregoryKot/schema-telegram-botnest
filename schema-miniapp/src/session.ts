// Сессия мини-аппа: initData используется ОДИН раз, дальше живём на Bearer.
//
// Инцидент 2026-07-29: Telegram выдаёт initData при открытии мини-аппа и
// больше не обновляет её, пока webview жив. Свернул на час — та же строка с
// протухшим `auth_date`, каждый запрос 401. Лечение: пока initData свежая,
// меняем её на пару access/refresh (эндпоинт как у сайта), дальше живём на
// Bearer. Access — 15 минут, продлевается refresh-кукой (30 дней), в памяти
// (не localStorage) — переживать перезапуск webview должна кука, не токен.
//
// Сетевая половина (postAuth/attemptRenewOnce) — в sessionRenew.ts,
// online/visibilitychange — в sessionRetryListeners.ts: этот файл держит
// только состояние сессии (файл-храповик, правило №10 CLAUDE.md).
import { getHost } from '../../shared/src/host';
import { renewWithRetries } from '../../shared/src/auth/sessionRefresh';
import { withCrossTabLock } from '../../shared/src/auth/crossTabLock';
import { clearApiCache } from '../../shared/src/api/apiCache';
import { markAuthSeen } from '../../shared/src/auth/authSeen';
import { attemptRenewOnce } from './sessionRenew';
import { registerSessionRetryListeners } from './sessionRetryListeners';

const EXPIRY_SKEW_MS = 60_000; // обновляемся заранее, с запасом на расхождение часов
const DEAD_SESSION_COOLDOWN_MS = 30_000; // не долбим сервер, если чинить нечем прямо сейчас

export const SESSION_EXPIRED_EVENT = 'session-expired';
/** AppErrorScreen различает ветки по «401». Название мессенджера он берёт у
 *  хоста — та же строка показывается и в MAX, поэтому «Telegram» тут нет. */
export const SESSION_EXPIRED_ERROR = 'Не удалось получить доступ (401)';

let accessToken: string | null = null;
let accessExpiresAt = 0;
// Один общий промис на все параллельные попытки: параллельная ротация
// refresh-токена выглядела бы для сервера кражей и отозвала бы всю семью.
let inFlight: Promise<boolean> | null = null;
let bootstrapped: Promise<boolean> | null = null;
let deadUntil = 0;
// 'dead' — только если сервер ЯВНО отказал (401/403), 'transient' — сеть/5xx
// (2026-08-21), null — попытка удалась или её не было. apiClient.ts различает
// по значению — временную беду не показывает как «сессия истекла».
let lastRenewFailureKind: 'dead' | 'transient' | null = null;

function tokenIsFresh(now = Date.now()): boolean {
  return !!accessToken && now + EXPIRY_SKEW_MS < accessExpiresAt;
}

function remember(token: string, expiresIn: number): void {
  // Отметка «в этом контейнере вход удавался» — по ней экран входа отличит
  // новичка от человека, у которого истекла сессия (shared/auth/authSeen).
  markAuthSeen();
  accessToken = token;
  accessExpiresAt = Date.now() + expiresIn * 1000;
  deadUntil = 0;
  lastRenewFailureKind = null;
}

export function clearSession(): void {
  accessToken = null;
  accessExpiresAt = 0;
  inFlight = null;
  bootstrapped = null;
  deadUntil = 0;
  lastRenewFailureKind = null;
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

/**
 * Перевыпуск сессии (последовательность refresh→exchange — в
 * sessionRenew.ts). withCrossTabLock сериализует ещё и вкладку сайта с
 * установленным мини-аппом — один origin, одна refresh-кука (2026-08-21).
 * renewWithRetries переживает временную беду (сеть/5xx) вместо отказа по
 * живой куке.
 */
export function renewSession(): Promise<boolean> {
  if (tokenIsFresh()) return Promise.resolve(true);
  if (Date.now() < deadUntil) return Promise.resolve(false);
  if (inFlight) return inFlight;
  inFlight = withCrossTabLock('auth-refresh', () =>
    renewWithRetries(() => attemptRenewOnce(getHost().sessionExchange())),
  )
    .then((result) => {
      if (result.ok) {
        remember(result.token, result.expiresIn);
        return true;
      }
      // Кулдаун общий для «сессия мертва» и «ретраи исчерпаны», а
      // lastRenewFailureKind хранит, ЧЕМ именно кончилось, для authedFetch.
      lastRenewFailureKind = result.dead ? 'dead' : 'transient';
      deadUntil = Date.now() + DEAD_SESSION_COOLDOWN_MS;
      return false;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/** true — сессию не восстановить, сервер подтвердил (401/403). Отличает
 *  «показать экран входа» от «сеть барахлит, оставить в приложении». */
export function isSessionDead(): boolean {
  return lastRenewFailureKind === 'dead' && Date.now() < deadUntil;
}

/** Чем кончилась ПОСЛЕДНЯЯ попытка перевыпуска. В отличие от isSessionDead
 *  не гаснет с кулдауном: экран ошибки решает по ней, «нет связи» это или
 *  «не удалось войти» (инцидент 31.08.2026, utils/pickErrorScreen.ts). */
export function lastRenewFailure(): 'dead' | 'transient' | null {
  return lastRenewFailureKind;
}

/** Может ли запрос авторизоваться прямо сейчас: живой Bearer или подпись
 *  площадки (initData в каждом запросе у Telegram/MAX). false — только
 *  веб-хост (PWA с ярлыка, вкладка) без токена: его authHeaders() пуст, и
 *  запрос без предварительного обмена refresh-куки обречён на 401. */
export function hasInstantAuth(): boolean {
  return tokenIsFresh() || Object.keys(getHost().authHeaders()).length > 0;
}

/** Стартовый обмен — один раз за загрузку, фоном: сессию надо выпустить, ПОКА
 *  initData свежая. В Telegram/MAX запросы его не ждут (подпись и так в
 *  каждом запросе); веб-хост без токена наоборот ЖДЁТ его в authedFetch —
 *  см. hasInstantAuth. Через час свернутое приложение найдёт живую
 *  refresh-куку вместо просроченной подписи. */
export function ensureSession(): Promise<boolean> {
  bootstrapped ??= renewSession();
  return bootstrapped;
}

/** Принять сессию от привязки к другому аккаунту (device-link). Прежний
 *  стартовый обмен надо забыть: иначе перевыпуск вернул бы в пустой аккаунт. */
export function adoptSession(token: string, expiresIn: number): void {
  bootstrapped = Promise.resolve(true);
  inFlight = null;
  remember(token, expiresIn);
  // Сессия — от ДРУГОГО аккаунта (device-link): кеш прежнего userId не переживает смену.
  clearApiCache();
}

/** Сессию восстановить не удалось — экран обязан сказать это пользователю. */
export function markSessionExpired(): void {
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
}

registerSessionRetryListeners({
  renewSession,
  clearTransientCooldown: () => {
    if (lastRenewFailureKind !== 'dead') deadUntil = 0;
  },
});
