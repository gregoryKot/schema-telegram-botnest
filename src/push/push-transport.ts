// Одна отправка в одну подписку и разбор исхода. Отдельно от PushService:
// исходы — самостоятельная таблица решений, и тест бьёт по ней без Nest.
//
// Исходы:
//   accepted — push-сервис принял (2xx);
//   gone     — подписки больше нет (404/410) или она не подходит к нашим
//              ключам (401/403: браузер подписан на другой публичный ключ) —
//              удалять;
//   unknown  — запрос оборван по таймауту: сервис мог принять, повтор дал бы
//              дубль (тот же класс, что «неизвестный исход» у Telegram, #681);
//   failed   — 429, 5xx, сеть: подписка жива, повтор на следующем тике.
import { sendNotification, type RequestOptions } from 'web-push';
import type { VapidConfig } from './push-config';
import type { PushKeys } from './push-subscription.store';

export type PushAttempt = 'accepted' | 'gone' | 'failed' | 'unknown';

export type SendFn = typeof sendNotification;

/** Предел ожидания push-сервиса: меньше SEND_TIMEOUT_MS очереди (15 с). */
export const PUSH_TIMEOUT_MS = 10_000;
/** Сколько push-сервис держит уведомление для выключенного устройства. */
export const PUSH_TTL_S = 24 * 60 * 60;

const GONE_STATUSES = new Set([401, 403, 404, 410]);
const TIMED_OUT = Symbol('push-timeout');

function statusOf(err: unknown): number | null {
  const code = (err as { statusCode?: unknown } | null)?.statusCode;
  return typeof code === 'number' ? code : null;
}

function isSocketTimeout(err: unknown): boolean {
  return err instanceof Error && /timeout/i.test(err.message);
}

/** Исход по ошибке web-push (чистая функция). */
export function classifyPushError(err: unknown): PushAttempt {
  const status = statusOf(err);
  if (status !== null) return GONE_STATUSES.has(status) ? 'gone' : 'failed';
  return isSocketTimeout(err) ? 'unknown' : 'failed';
}

export interface AttemptResult {
  result: PushAttempt;
  /** HTTP-статус ответа push-сервиса, если он был. */
  status: number | null;
}

/**
 * Отправить payload в подписку. Не бросает: любой исход — значение.
 * Таймаут двойной: `timeout` web-push — простой сокета, общий предел —
 * гонка с таймером (медленный ответ по байту сокет не роняет).
 */
export async function attemptPush(
  send: SendFn,
  keys: PushKeys,
  payload: string,
  vapid: VapidConfig,
  timeoutMs = PUSH_TIMEOUT_MS,
): Promise<AttemptResult> {
  const options: RequestOptions = {
    vapidDetails: vapid,
    TTL: PUSH_TTL_S,
    urgency: 'normal',
    timeout: timeoutMs,
  };
  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<typeof TIMED_OUT>((resolve) => {
    timer = setTimeout(() => resolve(TIMED_OUT), timeoutMs);
    timer.unref?.();
  });
  try {
    // Исход — значением, а не отказом: проигравший гонку запрос дорешится
    // сам, и его поздний отказ не всплывёт как unhandledRejection.
    const sent = send(
      {
        endpoint: keys.endpoint,
        keys: { p256dh: keys.p256dh, auth: keys.auth },
      },
      payload,
      options,
    ).then(
      (res): AttemptResult => ({ result: 'accepted', status: res.statusCode }),
      (err: unknown): AttemptResult => ({
        result: classifyPushError(err),
        status: statusOf(err),
      }),
    );
    const outcome = await Promise.race([sent, deadline]);
    return outcome === TIMED_OUT
      ? { result: 'unknown', status: null }
      : outcome;
  } catch (err: unknown) {
    // send бросил синхронно (битая подписка до запроса) — тот же разбор.
    return { result: classifyPushError(err), status: statusOf(err) };
  } finally {
    clearTimeout(timer);
  }
}
