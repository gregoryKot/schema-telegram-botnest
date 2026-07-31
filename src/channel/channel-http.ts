/**
 * Общий HTTP для адаптеров площадок: у VK, MAX, Threads и Pinterest разные
 * тела запросов, но одинаковая беда — молчаливый сбой. Ошибка тут всегда несёт
 * статус и тело ответа, иначе владельцу в алерт приезжает «не дошло» без
 * причины (инцидент 2026-07-29 был ровно про это).
 */

export class ChannelHttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(`${status}: ${body.slice(0, 300)}`);
    this.name = 'ChannelHttpError';
  }
}

/** Сколько ждём площадку. Тик расписания не должен висеть на зависшем API. */
const TIMEOUT_MS = 15_000;

// Клиент из того же пакета, что и диспетчер. Инцидент 2026-07-30: Agent из
// пакета undici, переданный ВСТРОЕННОМУ в Node fetch, роняет запрос с
// «UND_ERR_INVALID_ARG: invalid onRequestStart method» — у встроенной и
// пакетной версий разный протокол хендлеров. Поэтому запрос со своим
// диспетчером идёт пакетным fetch, а обычный — глобальным (его подменяют
// тесты, и лишняя зависимость там не нужна).
import { fetch as undiciFetch } from 'undici';

/**
 * Транспорт запроса. Нужен там, где площадке требуется свой корень доверия
 * (MAX после переезда на platform-api2): диспетчер подключается точечно, а не
 * расширяет доверие всему приложению. Тип свободный — fetch принимает его как
 * нестандартное поле, и тянуть ради него типы undici в общий модуль незачем.
 */
export interface RequestTransport {
  dispatcher?: unknown;
  /** Своё окно ожидания: у Threads связь дольше устанавливается. */
  timeoutMs?: number;
}

/**
 * Сколько раз повторяем запрос, до которого площадка НЕ ответила, и пауза
 * между попытками.
 *
 * Инцидент 2026-07-30: Threads с российского хостинга доступен через раз —
 * пост то уходил, то падал с «fetch failed». Повторить такой запрос безопасно:
 * сервер его не получил, дубля не будет. Ответ площадки (любой статус) не
 * повторяется никогда — там уже могло что-то создаться.
 *
 * Почему не общий слотовый ретрай: он срабатывает, только если не дошло НИ ОДНА
 * площадка. Пока Telegram и VK принимают пост, слот закрывается, и капризная
 * площадка теряла бы публикацию без единой повторной попытки.
 */
const NETWORK_RETRIES = 2;
const RETRY_PAUSE_MS = 1500;

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Ответ не получен: DNS, обрыв, таймаут. Только такие попытки повторяем. */
function isNetworkFailure(err: unknown): boolean {
  return !(err instanceof ChannelHttpError);
}

async function fetchWithRetry(
  url: string,
  init: RequestInit & RequestTransport,
): Promise<Response> {
  let last: unknown;
  for (let attempt = 0; attempt <= NETWORK_RETRIES; attempt++) {
    try {
      const send = init.dispatcher
        ? (undiciFetch as unknown as typeof fetch)
        : fetch;
      return await send(url, {
        ...init,
        signal: AbortSignal.timeout(init.timeoutMs ?? TIMEOUT_MS),
      });
    } catch (err) {
      last = err;
      if (!isNetworkFailure(err) || attempt === NETWORK_RETRIES) break;
      await pause(RETRY_PAUSE_MS);
    }
  }
  throw last;
}

async function request(
  url: string,
  init: RequestInit & RequestTransport,
): Promise<Record<string, unknown>> {
  const res = await fetchWithRetry(url, init);
  const raw = await res.text();
  if (!res.ok) throw new ChannelHttpError(res.status, raw);
  try {
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    // Тело не JSON при 200 — площадка ответила чем-то своим, это тоже сбой.
    throw new ChannelHttpError(res.status, raw);
  }
}

export function postJson(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
  transport: RequestTransport = {},
): Promise<Record<string, unknown>> {
  return request(url, {
    ...transport,
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

/** Форма VK: параметры в теле как application/x-www-form-urlencoded. */
export function postForm(
  url: string,
  params: Record<string, string>,
): Promise<Record<string, unknown>> {
  return request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
}

export function postEmpty(
  url: string,
  transport: RequestTransport = {},
): Promise<Record<string, unknown>> {
  return request(url, { ...transport, method: 'POST' });
}

export function getJson(url: string): Promise<Record<string, unknown>> {
  return request(url, { method: 'GET' });
}

/**
 * Ошибка → строка для владельца. Статус с телом («403: no access») полезнее
 * текста исключения, а таймаут и обрыв сети распознаются по имени/коду.
 */
export function describeHttpError(err: unknown): string {
  if (err instanceof ChannelHttpError) return err.message;
  const e = err as {
    name?: string;
    code?: string;
    message?: string;
    cause?: { code?: string; message?: string };
  } | null;
  if (e?.name === 'TimeoutError') return 'площадка не ответила вовремя';
  // fetch прячет настоящую причину в cause: сам он говорит только «fetch
  // failed», и по такому сообщению не отличить недоступный домен от битого
  // токена. Инцидент 2026-07-30: Threads не отвечал с прода, а отчёт советовал
  // проверить токен — искали не там.
  const code =
    e?.code ?? e?.cause?.code ?? (e?.name === 'AbortError' ? 'ABORTED' : null);
  const message = e?.message ?? '';
  const detail = e?.cause?.message;
  const full = detail && detail !== message ? `${message}: ${detail}` : message;
  if (code) return full ? `${code} (${full})` : code;
  return full || 'неизвестная ошибка';
}
