// HTTP-инфраструктура мини-аппа: базовый URL, заголовки, обёртки
// get/post/postJson/del с таймаутом, ретраями и перевыпуском сессии. Чистый
// транспорт — доменные методы живут в api.ts, состояние сессии — в session.ts.
import { BASE } from './utils/apiBase';
import { authHeaders, markSessionExpired, renewSession } from './session';

export { BASE, authHeaders };

export async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  ms = 15000,
): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// fetch() отклоняет промис TypeError-ом при обрыве связи/DNS-фейле; таймаут
// из fetchWithTimeout отклоняет AbortError. Оба случая — «сети нет прямо
// сейчас», а не осмысленный ответ сервера.
function isNetworkError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === 'AbortError') return true;
  return err instanceof TypeError;
}

// Статус ответа сервера (не сетевая ошибка) — отдельный класс, чтобы вызывающий
// код мог различить «сервер ответил 4xx» и «ответа не было вообще».
export class HttpStatusError extends Error {
  constructor(public status: number) {
    super(`API error: ${status}`);
  }
}

// Единственная точка отправки. На 401 один раз перевыпускает сессию и повторяет
// запрос: initData протухает через час после открытия мини-аппа, и без этого
// свернутое приложение переставало работать целиком (инцидент 2026-07-29).
// Перевыпустить не вышло — говорим об этом экрану, а не молчим.
export async function authedFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const send = () =>
    fetchWithTimeout(`${BASE}${path}`, { ...init, headers: authHeaders() });
  const res = await send();
  if (res.status !== 401) return res;
  if (!(await renewSession())) {
    markSessionExpired();
    return res;
  }
  const retried = await send();
  if (retried.status === 401) markSessionExpired();
  return retried;
}

// GET-ретраи: до 2 повторов с бэкоффом ~800мс/~2.5с ТОЛЬКО на сетевые
// ошибки и статусы 502/503/504 (временная недоступность инфры). 4xx и
// прочие 5xx не ретраятся — это осмысленный ответ сервера, повтор его не
// изменит. POST/DELETE здесь не участвуют: они не идемпотентны на уровне
// протокола (см. outbox.ts для единственного исключения — оценок).
const GET_RETRY_DELAYS_MS = [800, 2500];
const RETRYABLE_STATUSES = new Set([502, 503, 504]);

export async function get<T>(path: string): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await authedFetch(path);
      if (!res.ok) {
        if (
          RETRYABLE_STATUSES.has(res.status) &&
          attempt < GET_RETRY_DELAYS_MS.length
        ) {
          await delay(GET_RETRY_DELAYS_MS[attempt]);
          continue;
        }
        throw new HttpStatusError(res.status);
      }
      return res.json() as Promise<T>;
    } catch (err) {
      if (isNetworkError(err) && attempt < GET_RETRY_DELAYS_MS.length) {
        await delay(GET_RETRY_DELAYS_MS[attempt]);
        continue;
      }
      throw err;
    }
  }
}

// Тело ошибки сервера (message от ValidationPipe/контроллера) полезнее статуса:
// его показывают пользователю — вытаскиваем один раз для всех не-GET методов.
async function sendWithBody(
  path: string,
  method: 'POST' | 'DELETE',
  body?: unknown,
): Promise<Response> {
  const res = await authedFetch(path, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (res.ok) return res;
  let msg = `API error: ${res.status}`;
  try {
    const j = (await res.json()) as { message?: unknown };
    if (j?.message)
      msg =
        typeof j.message === 'string' ? j.message : JSON.stringify(j.message);
  } catch {
    /* тело ответа не распарсилось — оставляем дефолтный msg */
  }
  throw new Error(msg);
}

export async function post(path: string, body: unknown): Promise<void> {
  await sendWithBody(path, 'POST', body);
}

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await sendWithBody(path, 'POST', body);
  return res.json() as Promise<T>;
}

export async function del(path: string, body?: unknown): Promise<void> {
  await sendWithBody(path, 'DELETE', body);
}
