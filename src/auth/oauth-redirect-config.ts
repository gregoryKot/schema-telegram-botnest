// Проверка конфигурации при старте (инцидент 2026-09-16): адрес возврата
// каждого настроенного OAuth-провайдера обязан вести на канонический хост —
// иначе redirectToCallbackHost (oauth-host.ts) зациклился бы с хостовым
// мидлваром main.ts (см. src/infra/canonical-host.ts). Чистая функция от
// env — вызывается и из capability-report.ts (щит, волна 8), и из своего
// теста.
import type { CapabilityStatus } from '../infra/capability-report';
import { isRedirectedHost } from '../infra/canonical-host';

export interface OauthRedirectIssue {
  envVar: string;
  host: string;
}

type Env = Record<string, string | undefined>;

// GOOGLE_REDIRECT_URI/VK_REDIRECT_URI — явный redirect_uri провайдера.
// WEBAPP_URL — из него TelegramOidcProvider.callbackOrigin() строит колбэк.
const REDIRECT_ENV_VARS = [
  'GOOGLE_REDIRECT_URI',
  'VK_REDIRECT_URI',
  'WEBAPP_URL',
];

function badHost(raw: string | undefined): string | null {
  if (!raw?.trim()) return null; // провайдер не настроен — не наша забота
  let host: string;
  try {
    host = new URL(raw).host.toLowerCase();
  } catch {
    return null; // битый URL — отдельная проблема, не про хост-редирект
  }
  return isRedirectedHost(host) ? host : null;
}

/** Какие из настроенных адресов возврата ведут на перенаправляемый хост. */
export function findMisconfiguredOauthRedirects(
  env: Env = process.env,
): OauthRedirectIssue[] {
  const issues: OauthRedirectIssue[] = [];
  for (const envVar of REDIRECT_ENV_VARS) {
    const host = badHost(env[envVar]);
    if (host) issues.push({ envVar, host });
  }
  return issues;
}

/** Готовая запись реестра возможностей (src/infra/capability-report.ts). */
export function buildOauthRedirectCapability(
  env: Env = process.env,
): CapabilityStatus {
  return {
    id: 'oauthRedirectSane',
    title: 'Адрес возврата OAuth ведёт на канонический хост',
    on: findMisconfiguredOauthRedirects(env).length === 0,
    envVars: REDIRECT_ENV_VARS,
    offReason:
      'Адрес возврата OAuth ведёт на хост, который сервер сам редиректит ' +
      'дальше (legacy/www) — вход зациклится (ERR_TOO_MANY_REDIRECTS): ' +
      'GOOGLE_REDIRECT_URI/VK_REDIRECT_URI/WEBAPP_URL указывают не на ' +
      'канонический хост.',
    files: ['src/auth/oauth-host.ts'],
    critical: false,
  };
}
