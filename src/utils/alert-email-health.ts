// Снимок последней отправки письма-фолбэка алертов через Resend (аудит
// 2026-10-11: sendEmail не смотрел ответ, отозванный ключ и 403/429 считались
// доставкой и не оставляли ни строки в логе). Процессный синглтон — тот же
// приём, что у ../infra/self-check/state.ts и ../logger/db-outage.ts: admin-alert.ts
// пишет, проба самопроверки (../infra/self-check/probe-email.ts) читает.
//
// Лог — только уровнем warn. AlertLogger (../logger/alert.logger.ts) шлёт
// в DM лишь error, а error отсюда зациклил бы фолбэк сам на себя: письмо не
// ушло → error → AlertLogger → notifyAdminWithFallback → письмо не ушло.
// В лог не попадают ни ключ, ни текст письма, ни тело ответа Resend (в нём
// может быть адрес) — только HTTP-статус.
import { Logger } from '@nestjs/common';

export type AlertEmailFailure = number | 'network' | 'timeout';
export type AlertEmailAttempt =
  { ok: true } | { ok: false; status: AlertEmailFailure };

export interface AlertEmailHealth {
  /** Unix ms последней попытки отправки; null — в этом процессе писем не было. */
  at: number | null;
  ok: boolean;
  /** Причина последнего отказа; null, если последняя попытка удалась. */
  status: AlertEmailFailure | null;
  /** Unix ms последней удачной отправки. */
  lastOkAt: number | null;
}

/** Одинаковый отказ повторяется в логе не чаще раза в это время. */
export const LOG_REPEAT_MS = 10 * 60_000;

const EMPTY: AlertEmailHealth = {
  at: null,
  ok: true,
  status: null,
  lastOkAt: null,
};
const logger = new Logger('AdminAlert');
let health: AlertEmailHealth = EMPTY;
let lastLogged: { at: number; status: AlertEmailFailure } | null = null;

export function describeAlertEmailFailure(status: AlertEmailFailure): string {
  if (typeof status === 'number') return `HTTP ${status}`;
  return status === 'timeout' ? 'таймаут' : 'сеть';
}

export function noteAlertEmailResult(
  r: AlertEmailAttempt,
  now: number = Date.now(),
): void {
  if (r.ok) {
    health = { at: now, ok: true, status: null, lastOkAt: now };
    lastLogged = null;
    return;
  }
  health = { ...health, at: now, ok: false, status: r.status };
  const repeat =
    lastLogged?.status === r.status && now - lastLogged.at < LOG_REPEAT_MS;
  if (repeat) return;
  lastLogged = { at: now, status: r.status };
  logger.warn(
    `Резервный канал алертов (Resend) не принял письмо: ${describeAlertEmailFailure(r.status)}`,
  );
}

/** Ответ Resend: смотрим только HTTP-статус, тело не читаем. */
export function noteAlertEmailResponse(res: {
  ok: boolean;
  status: number;
}): void {
  noteAlertEmailResult(
    res.ok ? { ok: true } : { ok: false, status: res.status },
  );
}

/** fetch не дошёл до ответа: таймаут (AbortSignal.timeout) или сеть. */
export function noteAlertEmailError(e: unknown): void {
  const timeout = (e as { name?: string } | null)?.name === 'TimeoutError';
  noteAlertEmailResult({ ok: false, status: timeout ? 'timeout' : 'network' });
}

export function getAlertEmailHealth(): AlertEmailHealth {
  return health;
}

/** Сброс между тестами. */
export function resetAlertEmailHealth(): void {
  health = EMPTY;
  lastLogged = null;
}
