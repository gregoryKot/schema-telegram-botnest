// Проверка env при старте (щит, инциденты 2026-09-15/16 — см. заголовок
// env-registry.ts). Чистая функция от env — тестируется без мутации
// глобалов, вызывается из main.ts и из блока /stats (env-check.format.ts).
import { ENV_REGISTRY } from './env-registry.entries';
import { findMisconfiguredOauthRedirects } from '../auth/oauth-redirect-config';

type Env = Record<string, string | undefined>;

export interface EnvInvalid {
  name: string;
  problem: string;
}

export interface CrossCheckIssue {
  id: string;
  problem: string;
}

export interface EnvCheckResult {
  missing: string[];
  invalid: EnvInvalid[];
  crossCheckIssues: CrossCheckIssue[];
}

export interface CrossCheck {
  id: string;
  check: (env: Env, mode: string) => string | null;
}

const isSet = (env: Env, key: string): boolean => Boolean(env[key]?.trim());

/** «X задан → Y тоже обязан быть задан» — короче, чем писать это каждый раз. */
function requiresToo(id: string, cause: string, ...deps: string[]): CrossCheck {
  return {
    id,
    check: (env) => {
      if (!isSet(env, cause)) return null;
      const missing = deps.filter((d) => !isSet(env, d));
      if (missing.length === 0) return null;
      return `${cause} задан, но не задан(ы) ${missing.join(', ')}`;
    },
  };
}

// Кросс-проверки, которые не выражаются одним форматом одной переменной —
// связывают несколько переменных сразу. Сверку адреса возврата OAuth с
// каноническим хостом НЕ дублируем — она уже в oauth-redirect-config.ts,
// здесь только вызов.
export const CROSS_CHECKS: CrossCheck[] = [
  // Инцидент 2026-09-15: пустой ADMIN_EMAIL при заданном RESEND_API_KEY —
  // письма о записях молчали.
  requiresToo('resendRequiresAdminEmail', 'RESEND_API_KEY', 'ADMIN_EMAIL'),
  requiresToo('resendRequiresEmailFrom', 'RESEND_API_KEY', 'EMAIL_FROM'),
  requiresToo(
    'googleClientRequiresSecretAndRedirect',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_REDIRECT_URI',
  ),
  requiresToo('vkAppRequiresRedirect', 'VK_APP_ID', 'VK_REDIRECT_URI'),
  {
    id: 'encryptionKeyOldDistinctFromCurrent',
    check: (env) => {
      const current = env.ENCRYPTION_KEY?.trim();
      const olds = (env.ENCRYPTION_KEY_OLD ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (!current || olds.length === 0) return null;
      return olds.includes(current)
        ? 'ENCRYPTION_KEY_OLD содержит текущий ENCRYPTION_KEY — ротация не имеет смысла'
        : null;
    },
  },
  {
    id: 'skipAuthNotInProduction',
    check: (env, mode) =>
      mode === 'production' && env.SKIP_AUTH === 'true'
        ? 'SKIP_AUTH=true в production — проверка initData отключена целиком'
        : null,
  },
  {
    // Инцидент 2026-09-16: адрес возврата вёл на хост, который сервер сам
    // 301-редиректит дальше — вход зацикливался. Сама логика — в
    // src/auth/oauth-redirect-config.ts, здесь только сборка сообщения.
    id: 'oauthRedirectCanonicalHost',
    check: (env) => {
      const issues = findMisconfiguredOauthRedirects(env);
      if (issues.length === 0) return null;
      return issues
        .map(
          (i) =>
            `${i.envVar} ведёт на хост «${i.host}», который сам редиректится дальше`,
        )
        .join('; ');
    },
  },
];

/** Проверяет env по реестру (env-registry.entries.ts) + кросс-проверки. */
export function checkEnv(
  env: Env = process.env,
  mode: string = process.env.NODE_ENV ?? 'development',
): EnvCheckResult {
  const missing: string[] = [];
  const invalid: EnvInvalid[] = [];

  for (const spec of ENV_REGISTRY) {
    const raw = env[spec.name];
    const value = raw?.trim();
    if (!value) {
      if (spec.requiredInProd) missing.push(spec.name);
      continue;
    }
    const problem = spec.format(value);
    if (problem) invalid.push({ name: spec.name, problem });
  }

  const crossCheckIssues: CrossCheckIssue[] = [];
  for (const cc of CROSS_CHECKS) {
    const problem = cc.check(env, mode);
    if (problem) crossCheckIssues.push({ id: cc.id, problem });
  }

  return { missing, invalid, crossCheckIssues };
}
