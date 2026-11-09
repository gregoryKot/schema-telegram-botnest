// Таймауты keep-alive HTTP-сервера Nest. Путь запроса: Envoy Amvera → front
// (deploy/front-server.mjs, прозрачный TCP-проброс) → Nest на APP_PORT. Node
// по умолчанию закрывает простаивающее keep-alive соединение через 5 с, а
// прокси держит свои соединения к апстриму дольше: запрос, отправленный в
// сокет, который Node как раз закрывает, получает редкий 503 от прокси —
// известный источник одиночных сбоев за балансировщиком (docs/open/backend.md,
// разбор выкладки 2026-11-05). Сервер обязан держать простой дольше прокси, а
// headersTimeout — быть больше keepAliveTimeout: иначе соединение, переживающее
// простой, режется таймаутом заголовков раньше.
import type { Server } from 'node:http';

/** Простой keep-alive соединения до закрытия сервером. */
export const KEEP_ALIVE_TIMEOUT_MS = 65_000;
/** Ожидание заголовков запроса — строго больше KEEP_ALIVE_TIMEOUT_MS. */
export const HEADERS_TIMEOUT_MS = 66_000;

export function applyServerTimeouts(
  server: Pick<Server, 'keepAliveTimeout' | 'headersTimeout'>,
): void {
  server.keepAliveTimeout = KEEP_ALIVE_TIMEOUT_MS;
  server.headersTimeout = HEADERS_TIMEOUT_MS;
}
