// Настройки супервизора старта (deploy/entrypoint.mjs) из env — вынесены, чтобы
// entrypoint не рос (правило №10). Ручки и их смысл — docs/RUNBOOKS.md, «Прод
// лежит»; RECOVER_CMD/MIGRATE_CMD/APP_CMD и STARTUP_ALERT_API подменяют команды
// и адрес Bot API в тестах (src/infra/maintenance-startup.spec.ts).
import { positiveOr } from './crash-window.mjs';

export function readEntrypointConfig(env = process.env) {
  const num = (name, def) => Number(env[name] ?? def);
  return {
    APP_PORT: num('APP_PORT', 3001),
    RECOVER_CMD:
      env.RECOVER_CMD ??
      'npx prisma db execute --file prisma/recover-p3009.sql || true',
    MIGRATE_CMD: env.MIGRATE_CMD ?? 'npx prisma migrate deploy',
    // exec — чтобы внутри sh -c процессом стал сам node и SIGTERM дошёл до него.
    APP_CMD: env.APP_CMD ?? 'exec node dist/main',
    MAX_FAILS: num('STARTUP_MAX_FAILS', 3),
    BACKOFF_MS: num('STARTUP_BACKOFF_MS', 2000),
    // Пауза между сериями после исчерпанного лимита (×2 до потолка).
    COOLDOWN_MS: num('STARTUP_COOLDOWN_MS', 300000),
    COOLDOWN_MAX_MS: num('STARTUP_COOLDOWN_MAX_MS', 3600000),
    // Ожидание готовности БД перед миграциями (инцидент 2026-07-20, см.
    // wait-for-db.mjs) и ретраи migrate deploy на окне инициализации Postgres.
    DB_WAIT_TIMEOUT_MS: num('DB_WAIT_TIMEOUT_MS', 120000),
    DB_WAIT_INTERVAL_MS: num('DB_WAIT_INTERVAL_MS', 2000),
    DB_WAIT_CONNECT_MS: num('DB_WAIT_CONNECT_MS', 3000),
    MIGRATE_MAX_ATTEMPTS: num('MIGRATE_MAX_ATTEMPTS', 3),
    MIGRATE_BACKOFF_MS: num('MIGRATE_BACKOFF_MS', 3000),
    // Лимит серии (MAX_FAILS за 15 мин или MAX_FAILS_HOUR за час) и троттл DM — crash-window.mjs.
    CRASH_WINDOW_MS: positiveOr(env.STARTUP_CRASH_WINDOW_MS, 900000),
    MAX_FAILS_HOUR: positiveOr(env.STARTUP_MAX_FAILS_HOUR, 6),
    // DM о парковке (supervisor-status.mjs) — те же BOT_TOKEN/ADMIN_ID, что у приложения.
    BOT_TOKEN: env.BOT_TOKEN,
    ADMIN_ID: env.ADMIN_ID,
    ALERT_API: env.STARTUP_ALERT_API || 'https://api.telegram.org',
  };
}
