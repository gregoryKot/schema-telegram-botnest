import type { Request } from 'express';

/**
 * Хост запроса из заголовка Host (как в src/main.ts), а НЕ `req.hostname`:
 * при `trust proxy` Express берёт hostname из клиентского X-Forwarded-Host,
 * то есть значение подконтрольно атакующему. Всё, что отражается в HTML или
 * редиректе, строится от этого значения и сверяется с allow-list хостов.
 */
export function requestHost(req: Pick<Request, 'headers'>): string {
  return (req.headers.host ?? '').toLowerCase();
}
