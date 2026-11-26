// Анонимное событие (POST /api/public-event, userId = null). Сбой глотает
// вызывающий (trackPublicEvent в sharedApi.ts): аналитика не влияет на UX.
import type { ApiTransport } from './sharedApi';

/** keepalive — запрос переживает уход со страницы (клик по ссылке в той же вкладке). */
export interface SendOptions {
  keepalive?: boolean;
}

export type EventArgs = [
  name: string,
  meta?: Record<string, unknown>,
  opts?: SendOptions,
];

export const postEvent = (
  t: ApiTransport,
  ...[name, meta, opts]: EventArgs
): Promise<void> =>
  opts
    ? t.post('/api/public-event', { name, meta }, opts)
    : t.post('/api/public-event', { name, meta });
