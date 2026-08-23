// HTTP-инфраструктура сайта: базовый URL, заголовки, обёртки get/post/
// postJson/patchJson/del с таймаутом и перевыпуском сессии на 401 (доменные
// методы — в api.ts). Зеркало schema-miniapp/src/apiClient.ts (правило №3
// CLAUDE.md) — то же имя файла и то же назначение на обоих фронтендах.
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

export async function fetchWithTimeout(input: string, init: RequestInit, ms = 15000): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: ctrl.signal, credentials: 'include' });
  } finally {
    clearTimeout(id);
  }
}

// Ошибка HTTP-ответа со статусом ПОЛЕМ, а не подстрокой в message: потребители
// (ArticlePage: «настоящий 404 или сеть?») ветвятся по `status`. Зеркало
// HttpStatusError мини-аппа (apiClient.ts, правило №3).
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Тело может прийти не-JSON (502 от прокси, оборванное соединение) — тогда
// res.json() отклоняется, и body остаётся пустым объектом: message ниже не
// найдётся, в ход идёт дефолтное сообщение по статусу.
async function apiError(res: Response): Promise<ApiError> {
  const body = await res.json().catch(() => ({}) as { message?: unknown });
  const msg = body?.message
    ? typeof body.message === 'string' ? body.message : JSON.stringify(body.message)
    : `API error: ${res.status}`;
  return new ApiError(res.status, msg);
}

// Единственная точка отправки. На 401 перевыпускает сессию (через
// setRefreshHandler) один раз и повторяет запрос — зеркало
// schema-miniapp/src/apiClient.ts:authedFetch.
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
  return res.json();
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

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await authedFetch(path, { method: 'POST', body: JSON.stringify(body) });
  if (!res.ok) throw await apiError(res);
  return res.json();
}

export async function patchJson<T>(path: string, body: unknown): Promise<T> {
  const res = await authedFetch(path, { method: 'PATCH', body: JSON.stringify(body) });
  if (!res.ok) throw await apiError(res);
  return res.json();
}

export async function del(path: string, body?: unknown): Promise<void> {
  const res = await authedFetch(path, {
    method: 'DELETE',
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) throw await apiError(res);
}
