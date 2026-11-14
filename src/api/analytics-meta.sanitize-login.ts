// Санитайзер meta событий входа: только поля из allow-list, без текста и PII
// (правило №7). login_ticket_step, login_oauth пишет сервер (счёт — userId IS NULL).
import {
  LOGIN_TICKET_HOSTS,
  LOGIN_TICKET_PROVIDERS,
  LOGIN_TICKET_STEPS,
} from '../analytics/login-ticket-steps.constants';
import { ONE_TAP_OUTCOMES } from '../analytics/login-one-tap.constants';
import { LOGIN_METHOD_OFFER_ACTIONS } from '../analytics/login-method-offer.constants';
import { sanitizeLoginOauthMeta } from '../analytics/login-oauth.constants';

const STEP_SET = new Set<string>(LOGIN_TICKET_STEPS);
const HOST_SET = new Set<string>(LOGIN_TICKET_HOSTS);
const PROVIDER_SET = new Set<string>(LOGIN_TICKET_PROVIDERS);
const OUTCOME_SET = new Set<string>(ONE_TAP_OUTCOMES);
const OFFER_SET = new Set<string>(LOGIN_METHOD_OFFER_ACTIONS);

/** Ветка sanitizeMeta для событий входа (`login_*`); незнакомое — undefined. */
export function sanitizeLoginMeta(
  name: string,
  meta: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (name === 'login_ticket_step') return sanitizeLoginTicketMeta(meta);
  // Карточка «добавь почту или VK ID» — действие; окно Google — исход.
  const { action, outcome } = meta;
  if (name === 'login_method_offer' && typeof action === 'string')
    return OFFER_SET.has(action) ? { action } : undefined;
  if (name === 'login_one_tap' && typeof outcome === 'string')
    return OUTCOME_SET.has(outcome) ? { outcome } : undefined;
  return name === 'login_oauth' ? sanitizeLoginOauthMeta(meta) : undefined;
}

export function sanitizeLoginTicketMeta(
  meta: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const { step, host, provider } = meta;
  if (
    typeof step !== 'string' ||
    !STEP_SET.has(step) ||
    typeof host !== 'string' ||
    !HOST_SET.has(host)
  ) {
    return undefined;
  }
  // Способ входа необязателен (строки до 2026-11 без него), незнакомый — отказ.
  if (provider === undefined) return { step, host };
  return typeof provider === 'string' && PROVIDER_SET.has(provider)
    ? { step, host, provider }
    : undefined;
}
