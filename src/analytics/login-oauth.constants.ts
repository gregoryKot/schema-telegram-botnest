// Событие login_oauth: вход через внешний сервис (VK ID, Яндекс ID) дошёл до
// конца колбэка. Пишет только сервер (src/auth/oauth-login.report.ts), всегда с
// userId = null — приём login_ticket_step: /stats считает лишь такие строки,
// а подделка через POST /api/event несёт userId и в отчёт не попадает.
// До 2026-11 входы через провайдеров не считал никто: узнать, сколько людей
// входит через VK ID, было не из чего.
//
// Одно имя с провайдером и исходом внутри (приём login_one_tap): счёт — один
// раздел отчёта, в allow-list и санитайзере — одна запись.
// Отдельным файлом: analytics.constants.ts сверх лимита и обязан таять (№10).

/** Провайдеры с OAuth-колбэком; сверка с OAUTH_PROVIDER_ENV — в спеке отчёта. */
export const LOGIN_OAUTH_PROVIDERS = ['vk', 'yandex'] as const;
export type LoginOauthProvider = (typeof LOGIN_OAUTH_PROVIDERS)[number];

export const LOGIN_OAUTH_OUTCOMES = [
  /** Вошёл в аккаунт, где этот способ входа уже был. */
  'signed_in',
  /** Этого входа у нас не было — завёлся новый аккаунт. */
  'signed_up',
  /** У аккаунта второй фактор: дальше — экран кода, сессии ещё нет. */
  'twofa',
  /** Способ входа привязан к аккаунту, из которого начали привязку. */
  'linked',
  /** Вход уже принадлежит другому аккаунту — предложено объединение. */
  'merge',
] as const;
export type LoginOauthOutcome = (typeof LOGIN_OAUTH_OUTCOMES)[number];

const PROVIDER_SET = new Set<string>(LOGIN_OAUTH_PROVIDERS);
const OUTCOME_SET = new Set<string>(LOGIN_OAUTH_OUTCOMES);

export const isLoginOauthProvider = (id: string): id is LoginOauthProvider =>
  PROVIDER_SET.has(id);

/** Ветка sanitizeMeta: только провайдер и исход из закрытых списков. */
export function sanitizeLoginOauthMeta(
  meta: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const { provider, outcome } = meta;
  const known =
    typeof provider === 'string' &&
    PROVIDER_SET.has(provider) &&
    typeof outcome === 'string' &&
    OUTCOME_SET.has(outcome);
  return known ? { provider, outcome } : undefined;
}
