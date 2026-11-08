// HTTP-инфраструктура сайта: базовый URL, заголовки, обёртки get/post/
// postJson/patchJson/del с таймаутом и перевыпуском сессии на 401 (доменные
// методы — в api.ts).
//
// Диагностика «постоянно нужно логиниться заново» (2026-08-21, пункт 4): у
// сайта не было ни одной попытки перевыпустить сессию на 401 обычного
// запроса — mini-апп это уже умел (apiClient.ts:authedFetch), сайт просто
// бросал ошибку. Один истёкший access-токен ронял действие пользователя
// вместо тихого продления.
//
// Кеш GET (дедуп + stale-while-revalidate) и инвалидация мутаций —
// shared/src/api/apiCache*.ts (правило №3): authedFetch — единственная
// точка отправки, хук здесь покрывает и ratingApi (прямой вызов authedFetch).
import { cachedGet, isCacheableGetPath } from '../../shared/src/api/apiCache';
import { applyMutationInvalidation } from '../../shared/src/api/apiCacheRules';
import { readJsonBody } from '../../shared/src/api/readJsonBody';
import { readErrorBody } from '../../shared/src/api/readErrorBody';
import { withKeepalive } from '../../shared/src/api/keepalive';
import { fetchWithTimeout as fetchWithDeadline, REQUEST_TIMEOUT_MS } from '../../shared/src/api/fetchWithTimeout';

export const BASE_RAW = (import.meta.env.VITE_API_URL as string) ?? '';
export const BASE = BASE_RAW && !BASE_RAW.startsWith('http') ? `https://${BASE_RAW}` : BASE_RAW;

let _getToken: (() => string | null) | null = null;
let _refresh: (() => Promise<boolean>) | null = null;

export function setTokenProvider(fn: () => string | null): void {
  _getToken = fn;
}
/** AuthProvider кладёт сюда свой doRefresh — единственное место, умеющее
 *  перевыпускать сессию (in-flight/кросс-табный замок и ретраи — там же). */
export function setRefreshHandler(fn: () => Promise<boolean>): void {
  _refresh = fn;
}

function authHeaders(): Record<string, string> {
  const token = _getToken?.();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    'Content-Type': 'application/json',
  };
}

// Таймаут — общий с входом и выходом (shared/api/fetchWithTimeout, правило №3); сайт шлёт куку всегда.
export function fetchWithTimeout(input: string, init: RequestInit, ms = REQUEST_TIMEOUT_MS): Promise<Response> {
  return fetchWithDeadline(input, { ...init, credentials: 'include' }, ms);
}

// Ошибка HTTP-ответа со статусом ПОЛЕМ, а не подстрокой в message: потребители
// (ArticlePage: «настоящий 404 или сеть?») ветвятся по `status`.
export class ApiError extends Error {
  status: number;
  reason?: string; // машинный код причины из тела (`already_connected`)
  constructor(status: number, message: string, reason?: string) {
    super(message);
    this.status = status;
    this.reason = reason;
  }
}

// Разбор тела (message + машинный reason, не-JSON тело) — shared/readErrorBody.
async function apiError(res: Response): Promise<ApiError> {
  const { message, reason } = await readErrorBody(res);
  return new ApiError(res.status, message, reason);
}

// Единственная точка отправки. На 401 перевыпускает сессию (через
// setRefreshHandler) один раз и повторяет запрос.
export async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const send = () => fetchWithTimeout(`${BASE}${path}`, { ...init, headers: authHeaders() });
  const res = await send();
  if (res.status !== 401 || !_refresh) {
    if (res.ok) applyMutationInvalidation(init.method, path, init.body);
    return res;
  }
  if (!(await _refresh())) return res;
  const retried = await send();
  if (retried.ok) applyMutationInvalidation(init.method, path, init.body);
  return retried;
}

async function rawGet<T>(path: string): Promise<T> {
  const res = await authedFetch(path);
  if (!res.ok) throw await apiError(res);
  return readJsonBody<T>(res);
}

// Кеш живёт в памяти вкладки (shared/src/api/apiCache.ts) — дедуп
// одновременных запросов и stale-while-revalidate на возврате в открытый
// экран. /api/auth/* и health исключены isCacheableGetPath.
export function get<T>(path: string): Promise<T> {
  if (!isCacheableGetPath(path)) return rawGet<T>(path);
  return cachedGet(path, () => rawGet<T>(path));
}

export async function post(path: string, body: unknown): Promise<void> {
  const res = await authedFetch(path, { method: 'POST', body: JSON.stringify(body) });
  if (!res.ok) throw await apiError(res);
}

// Досылка автосохранения при уходе со страницы (shared/src/utils/usePendingSave.ts)
// идёт keepalive-запросом — его браузер не обрывает вместе со страницей.
export interface SendOptions { keepalive?: boolean }

export async function postJson<T>(path: string, body: unknown, opts?: SendOptions): Promise<T> {
  const res = await authedFetch(path, withKeepalive({ method: 'POST', body: JSON.stringify(body) }, opts));
  if (!res.ok) throw await apiError(res);
  return readJsonBody<T>(res);
}

export async function patchJson<T>(path: string, body: unknown, opts?: SendOptions): Promise<T> {
  const res = await authedFetch(path, withKeepalive({ method: 'PATCH', body: JSON.stringify(body) }, opts));
  if (!res.ok) throw await apiError(res);
  return readJsonBody<T>(res);
}

export async function del(path: string, body?: unknown): Promise<void> {
  const res = await authedFetch(path, {
    method: 'DELETE',
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) throw await apiError(res);
}
