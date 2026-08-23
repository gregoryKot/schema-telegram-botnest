// HTTP-инфраструктура мини-аппа: get/post/postJson/del с таймаутом, ретраями и перевыпуском сессии (доменные методы — api.ts, состояние сессии — session.ts).
// Кеш GET (дедуп + stale-while-revalidate) и инвалидация мутаций — shared/src/api/apiCache*.ts (правило №3); authedFetch — единственная точка отправки, хук здесь покрывает и ratingApi/updatePhraseCheck (прямые вызовы authedFetch).
import { BASE } from './utils/apiBase';
import {
  authHeaders,
  isSessionDead,
  markSessionExpired,
  renewSession,
} from './session';
import { cachedGet, isCacheableGetPath } from '../../shared/src/api/apiCache';
import { applyMutationInvalidation } from '../../shared/src/api/apiCacheRules';

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

// Единственная точка отправки. На 401 перевыпускает сессию и повторяет запрос
// (инцидент 2026-07-29). Не вышло ИЗ-ЗА СЕССИИ (401/403 от refresh) — говорим
// об этом экрану; не вышло из-за сети/5xx — сессия жива, молчим, оставляем
// пользователя в приложении (диагностика 2026-08-21).
export async function authedFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const send = () =>
    fetchWithTimeout(`${BASE}${path}`, { ...init, headers: authHeaders() });
  const res = await send();
  if (res.status !== 401) {
    if (res.ok) applyMutationInvalidation(init.method, path, init.body);
    return res;
  }
  if (!(await renewSession())) {
    if (isSessionDead()) markSessionExpired();
    return res;
  }
  const retried = await send();
  if (retried.status === 401) markSessionExpired();
  else if (retried.ok) applyMutationInvalidation(init.method, path, init.body);
  return retried;
}

// GET-ретраи: до 2 повторов с бэкоффом ~800мс/~2.5с ТОЛЬКО на сетевые ошибки
// и 502/503/504. 4xx и прочие 5xx не ретраятся — осмысленный ответ сервера.
// POST/DELETE не участвуют — не идемпотентны (см. outbox.ts, исключение — оценки).
const GET_RETRY_DELAYS_MS = [800, 2500];
const RETRYABLE_STATUSES = new Set([502, 503, 504]);

async function rawGet<T>(path: string): Promise<T> {
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

// Кеш живёт в памяти вкладки (shared/src/api/apiCache.ts) — дедуп
// одновременных запросов и stale-while-revalidate на возврате в открытый
// экран. /api/auth/* и health исключены isCacheableGetPath.
export function get<T>(path: string): Promise<T> {
  if (!isCacheableGetPath(path)) return rawGet<T>(path);
  return cachedGet(path, () => rawGet<T>(path));
}

// Тело ошибки (message от ValidationPipe) полезнее статуса — вытаскиваем один раз для всех не-GET методов.
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
