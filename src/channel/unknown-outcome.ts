import { isConnectFailure } from './connect-failure';

/**
 * Исход отправки неизвестен: запрос мог дойти до площадки, а ответа нет.
 *
 * Хвост R7 (аудит 2026-11, R8): досылка через 15 минут повторяла площадку с
 * «не дошло» в журнале и тогда, когда мы не дождались ответа или связь
 * оборвалась уже после отправки. Пост к тому моменту мог выйти, и досылка
 * давала в канале второй. Теперь такой исход пишется в журнал с меткой в
 * `reason` (колонки не нужно), досылка его не повторяет, а владелец один раз
 * за слот получает просьбу проверить площадку руками.
 *
 * Что считается «мог дойти» — обратное connect-failure.ts:
 *   - наша отмена по таймауту (AbortError, TimeoutError; у node-fetch внутри
 *     telegraf — `type: 'aborted' | 'request-timeout' | 'body-timeout'`);
 *   - обрыв после записи запроса (ECONNRESET, EPIPE, «socket hang up»,
 *     undici UND_ERR_SOCKET «other side closed»), таймауты заголовков и тела,
 *     ETIMEDOUT не на фазе подключения.
 * Не входит: сбой подключения (запрос не ушёл — досылать безопасно), ответ
 * площадки с кодом (она ответила отказом) и ошибки до запроса (нет токена,
 * картинка не собралась).
 */

const AFTER_SEND_CODES = new Set([
  'ECONNRESET',
  'EPIPE',
  'ETIMEDOUT',
  'UND_ERR_SOCKET',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
  'UND_ERR_ABORTED',
]);
const AFTER_SEND_TYPES = new Set([
  'aborted',
  'request-timeout',
  'body-timeout',
]);
const AFTER_SEND_TEXT = /socket hang up|other side closed|^terminated$/;

type Layer = Record<string, unknown>;

function layerIsAfterSend(e: Layer): boolean {
  if (e.name === 'AbortError' || e.name === 'TimeoutError') return true;
  const has = (set: Set<string>, v: unknown) =>
    typeof v === 'string' && set.has(v);
  if (has(AFTER_SEND_CODES, e.code) || has(AFTER_SEND_TYPES, e.type))
    return true;
  return typeof e.message === 'string' && AFTER_SEND_TEXT.test(e.message);
}

/** Запрос мог дойти, ответа нет — пост, возможно, вышел. */
export function isAfterSendFailure(err: unknown): boolean {
  if (!err || typeof err !== 'object' || isConnectFailure(err)) return false;
  const top = err as Layer;
  const cause = top.cause;
  return (
    layerIsAfterSend(top) ||
    (!!cause && typeof cause === 'object' && layerIsAfterSend(cause as Layer))
  );
}

/** Метка в начале `reason` строки журнала. */
export const UNKNOWN_OUTCOME = 'исход неизвестен';

export const markUnknown = (reason: string): string =>
  `${UNKNOWN_OUTCOME}: ${reason}`;

export const isUnknownReason = (reason: string | null | undefined): boolean =>
  !!reason && reason.startsWith(`${UNKNOWN_OUTCOME}:`);

/** Отказы публикации → настоящие отказы и площадки, где пост мог выйти. */
export function splitUnknown<T extends { platform: string; reason: string }>(
  failed: T[],
): { failed: T[]; unknown: string[] } {
  const unknown = failed.filter((f) => isUnknownReason(f.reason));
  return {
    failed: failed.filter((f) => !unknown.includes(f)),
    unknown: unknown.map((f) => f.platform),
  };
}

/** Сообщение владельцу: досылки не будет, площадку проверить руками. */
export function unknownOutcomeText(slot: string, platforms: string[]): string {
  return (
    `Канал ЗВ (${slot}): ${platforms.join(', ')} — исход отправки неизвестен: ` +
    'ответа не дождались или связь оборвалась после отправки, пост мог выйти. ' +
    'Досылки не будет, чтобы не вышло дубля: площадку нужно проверить вручную ' +
    'и, если поста там нет, опубликовать руками.'
  );
}

/**
 * Троттлинг этого сообщения: досылка заглядывает в журнал каждые 15 минут,
 * а владельцу про площадку в слоте хватит одного раза. Память процесса:
 * после рестарта сообщение может прийти ещё раз — это дешевле молчания.
 */
export class UnknownOutcomeWarnings {
  private readonly warned = new Set<string>();

  /** Площадки, о которых в этом слоте ещё не говорили; помечает их. */
  fresh(slotKey: string, platforms: string[]): string[] {
    // Ключ слота начинается с даты (YYYY-MM-DD): вчерашние метки не нужны.
    const day = slotKey.slice(0, 10);
    for (const k of this.warned) if (!k.startsWith(day)) this.warned.delete(k);
    const out = platforms.filter((p) => !this.warned.has(`${slotKey}:${p}`));
    for (const p of out) this.warned.add(`${slotKey}:${p}`);
    return out;
  }
}
