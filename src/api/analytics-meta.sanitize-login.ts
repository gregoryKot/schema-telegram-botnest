// Санитайзер meta для login_ticket_step. Пропускаем ТОЛЬКО {step, host} и
// только из allow-list: свободный текст и PII в meta недопустимы (правило №7).
//
// Событие пишет исключительно сервер, а отчёт считает строки с userId IS NULL —
// клиентская подделка в него не попадёт. Meta всё равно ограничиваем: нижний
// слой не должен полагаться на то, что верхний не ошибётся.
import {
  LOGIN_TICKET_HOSTS,
  LOGIN_TICKET_STEPS,
} from '../analytics/login-ticket-steps.constants';
import { ONE_TAP_OUTCOMES } from '../analytics/login-one-tap.constants';

const STEP_SET = new Set<string>(LOGIN_TICKET_STEPS);
const HOST_SET = new Set<string>(LOGIN_TICKET_HOSTS);
const OUTCOME_SET = new Set<string>(ONE_TAP_OUTCOMES);

/** Ветка sanitizeMeta для событий входа (`login_*`); незнакомое — undefined. */
export function sanitizeLoginMeta(
  name: string,
  meta: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (name === 'login_ticket_step') return sanitizeLoginTicketMeta(meta);
  // login_one_tap (окно Google): только исход из закрытого списка.
  const outcome = meta.outcome;
  if (name === 'login_one_tap' && typeof outcome === 'string')
    return OUTCOME_SET.has(outcome) ? { outcome } : undefined;
  return undefined;
}

export function sanitizeLoginTicketMeta(
  meta: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const step = meta.step;
  const host = meta.host;
  if (
    typeof step === 'string' &&
    STEP_SET.has(step) &&
    typeof host === 'string' &&
    HOST_SET.has(host)
  ) {
    return { step, host };
  }
  return undefined;
}
