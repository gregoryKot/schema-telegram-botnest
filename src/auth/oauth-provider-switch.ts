// Рубильник входа через OAuth-провайдера (аудит 2026-11, docs/open/security.md):
// снять env провайдера = выключить вход через него. Раньше старт падал на
// `getOrThrow` голым 500, и выключить сломанный вход, не ухудшив картину, было
// нечем. Теперь старт без конфигурации ведёт на экран «Ошибка входа» с причиной
// `<id>_disabled`; её текст — в словаре `webapp/src/pages/service/authErrorReasons.ts`
// (сверку держит oauth-provider-switch.spec.ts).
//
// Состав — те же переменные, что требует сверка env (`requiresToo` в
// `src/infra/env-check.ts`): без любой из них вход не доходит до конца.
export const OAUTH_PROVIDER_ENV: Readonly<Record<string, readonly string[]>> = {
  google: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI'],
  vk: ['VK_APP_ID', 'VK_REDIRECT_URI'],
};

/** Причина для `/auth/error?reason=` у выключенного провайдера. */
export const disabledReason = (provider: string): string =>
  `${provider}_disabled`;

/** Чтение env — срез ConfigService (в спеке — подделка без Nest). */
export interface EnvReader {
  get<T = string>(name: string): T | undefined;
  getOrThrow<T = string>(name: string): T;
}

/**
 * Адрес экрана ошибки, если у провайдера не задана хоть одна переменная;
 * `null` — провайдер включён (или не из списка: тогда решает сам обработчик).
 */
export function disabledProviderRedirect(
  provider: string,
  config: EnvReader,
): string | null {
  const names = OAUTH_PROVIDER_ENV[provider];
  if (!names || names.every((n) => config.get<string>(n)?.trim())) return null;
  const base = config.getOrThrow<string>('WEBAPP_URL').replace(/\/$/, '');
  return `${base}/auth/error?reason=${disabledReason(provider)}`;
}
