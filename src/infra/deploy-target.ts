// Площадка, на которой запущен процесс. Раньше признака не было: код не мог
// отличить Amvera (бэкапы платформы, CNPG) от VPS, где `pgdata` — именованный
// volume на диске сервера и единственная копия базы (аудит 2026-10, infra#11).
// `DEPLOY_TARGET=vps` задаёт deploy/vps/docker-compose.yml в `environment`
// контейнера app (как DATABASE_URL: из PROD_ENV его не берём, там env Amvera).
// Переменная не задана — значит Amvera, поведение прежнее.

type Env = Record<string, string | undefined>;

export const DEPLOY_TARGET_ENV_VARS = ['DEPLOY_TARGET'] as const;

export const DEPLOY_TARGETS = ['amvera', 'vps'] as const;

export function isVpsTarget(env: Env = process.env): boolean {
  return env[DEPLOY_TARGET_ENV_VARS[0]]?.trim() === 'vps';
}
