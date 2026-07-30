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

/**
 * Транспорт запроса. Нужен там, где площадке требуется свой корень доверия
 * (MAX после переезда на platform-api2): диспетчер подключается точечно, а не
 * расширяет доверие всему приложению. Тип свободный — fetch принимает его как
 * нестандартное поле, и тянуть ради него типы undici в общий модуль незачем.
 */
export interface RequestTransport {
  dispatcher?: unknown;
}

async function request(
  url: string,
  init: RequestInit & RequestTransport,
): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
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

export function postEmpty(url: string): Promise<Record<string, unknown>> {
  return request(url, { method: 'POST' });
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
  const e = err as { name?: string; code?: string; message?: string } | null;
  if (e?.name === 'TimeoutError') return 'площадка не ответила за 15 секунд';
  const code = e?.code ?? (e?.name === 'AbortError' ? 'ABORTED' : null);
  const message = e?.message ?? '';
  if (code) return message ? `${code} (${message})` : code;
  return message || 'неизвестная ошибка';
}
