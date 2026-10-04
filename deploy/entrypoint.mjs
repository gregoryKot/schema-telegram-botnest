// Точка входа контейнера (Dockerfile CMD). Node-супервизор старта.
//
// Публичный порт 3000 с ПЕРВОЙ секунды держит front (deploy/front-server.mjs),
// приложение слушает внутренний APP_PORT. Пока идёт старт (recover → migrate →
// буст Nest) или приложение крашлупит, клиент видит нашу страницу техработ, а
// не generic-503 Amvera; поднялось — front прозрачно проксирует; упало — снова
// техработы. Окна с пустым портом нет (кроме пересборки образа — платформа).
//
// Логика:
//   1. front поднимается сразу (владеет портом 3000 всю жизнь контейнера);
//   2. recover-p3009 (идемпотентно, ошибки игнорируем);
//   3. migrate deploy — упал → front остаётся на техработах, приложение не
//      стартуем (не гоним крашлуп по битой схеме);
//   4. node dist/main на APP_PORT — с ограниченным числом перезапусков
//      (транзиентный краш восстанавливается сам); исчерпали лимит → техработы.
//   5. после миграций — планировщик бэкапов в B2 (backup-scheduler.cjs).
//
// Graceful shutdown: Node как PID 1 ловит SIGTERM/SIGINT, пробрасывает их
// приложению (bot.stop, prisma disconnect), затем закрывает front и выходит.
import { spawn } from 'node:child_process';
import { startFront } from './front-server.mjs';
import backupScheduler from './backup-scheduler.cjs';
import { parseDbTarget, waitForDb } from './wait-for-db.mjs';

const PORT =
  process.env.PORT !== undefined && process.env.PORT !== ''
    ? Number(process.env.PORT)
    : 3000;
const APP_PORT = Number(process.env.APP_PORT ?? 3001);
const RECOVER_CMD =
  process.env.RECOVER_CMD ??
  'npx prisma db execute --file prisma/recover-p3009.sql || true';
const MIGRATE_CMD = process.env.MIGRATE_CMD ?? 'npx prisma migrate deploy';
// exec — чтобы внутри sh -c процессом стал сам node и SIGTERM дошёл до него.
const APP_CMD = process.env.APP_CMD ?? 'exec node dist/main';
const MAX_FAILS = Number(process.env.STARTUP_MAX_FAILS ?? 3);
const BACKOFF_MS = Number(process.env.STARTUP_BACKOFF_MS ?? 2000);
// Ожидание готовности БД перед миграциями (инцидент 2026-07-20, см.
// wait-for-db.mjs) и ретраи migrate deploy на окне инициализации Postgres.
const DB_WAIT_TIMEOUT_MS = Number(process.env.DB_WAIT_TIMEOUT_MS ?? 120000);
const DB_WAIT_INTERVAL_MS = Number(process.env.DB_WAIT_INTERVAL_MS ?? 2000);
const DB_WAIT_CONNECT_MS = Number(process.env.DB_WAIT_CONNECT_MS ?? 3000);
const MIGRATE_MAX_ATTEMPTS = Number(process.env.MIGRATE_MAX_ATTEMPTS ?? 3);
const MIGRATE_BACKOFF_MS = Number(process.env.MIGRATE_BACKOFF_MS ?? 3000);
// Проработал дольше — считаем следующий краш «свежим», а не частью крашлупа.
const HEALTHY_UPTIME_MS = Number(process.env.STARTUP_HEALTHY_MS ?? 60000);

// Front занимает публичный порт немедленно; приложение живёт на APP_PORT.
const front = startFront({ port: PORT, appPort: APP_PORT });

let current = null;
let shuttingDown = false;
let cleanExit = false;
let backup = null; // планировщик бэкапов в B2 (deploy/backup-scheduler.cjs)

function finish() {
  // Front держит event loop живым. Выходим только при чистом выходе приложения
  // или сигнале; при техработах — НЕ выходим: front отдаёт страницу.
  backup?.stop();
  front.close(() => process.exit(0));
  // Страховка, если close висит на удерживаемых соединениях.
  setTimeout(() => process.exit(0), 3000).unref();
}

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    shuttingDown = true;
    // Есть живой ребёнок (app) → пробрасываем сигнал для graceful shutdown;
    // дождёмся его выхода в main() и закроемся там. Нет ребёнка (идут техработы
    // или пауза) → закрываемся сами.
    if (current && !current.killed) current.kill(sig);
    else finish();
  });
}

function run(cmdStr, extraEnv) {
  return new Promise((resolve) => {
    const child = spawn('sh', ['-c', cmdStr], {
      stdio: 'inherit',
      env: extraEnv ? { ...process.env, ...extraEnv } : process.env,
    });
    current = child;
    child.on('exit', (code, signal) => {
      current = null;
      resolve({ code: code ?? 0, signal });
    });
    child.on('error', () => {
      current = null;
      resolve({ code: 1, signal: null });
    });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // Ждём готовности БД перед recover/migrate: Postgres-под Amvera (CNPG) при
  // рестарте поднимается медленнее приложения, и migrate deploy падал с P1001 →
  // entrypoint навсегда парковался на техработах (инцидент 2026-07-20). Ждём
  // TCP-порт — P1001 это и есть отказ connect; front пока отдаёт техработы.
  const dbTarget = parseDbTarget(process.env.DATABASE_URL);
  if (dbTarget) {
    const reachable = await waitForDb({
      target: dbTarget,
      timeoutMs: DB_WAIT_TIMEOUT_MS,
      intervalMs: DB_WAIT_INTERVAL_MS,
      connectTimeoutMs: DB_WAIT_CONNECT_MS,
      log: (m) => console.warn(m),
    });
    if (shuttingDown) return;
    if (!reachable) {
      console.error('[entrypoint] БД не поднялась в отведённое время — держу техработы');
      return;
    }
  }

  await run(RECOVER_CMD);
  if (shuttingDown) return;

  // migrate deploy с ретраями: открытый TCP не гарантирует, что Postgres готов
  // (окно инициализации). Битый SQL/P3009 ретраи не вылечат — лишь отложат
  // техработы на backoff, в крашлуп это не роняет.
  let migrateOk = false;
  for (let attempt = 1; attempt <= MIGRATE_MAX_ATTEMPTS; attempt++) {
    const migrate = await run(MIGRATE_CMD);
    if (shuttingDown) return;
    if (!migrate.signal && migrate.code === 0) {
      migrateOk = true;
      break;
    }
    console.error(
      `[entrypoint] migrate deploy упал (попытка ${attempt}/${MIGRATE_MAX_ATTEMPTS}, code=${migrate.code})`,
    );
    if (attempt < MIGRATE_MAX_ATTEMPTS) await sleep(MIGRATE_BACKOFF_MS);
    if (shuttingDown) return;
  }
  if (!migrateOk) {
    console.error('[entrypoint] migrate deploy не прошёл — держу страницу техработ');
    return; // front уже отдаёт техработы; приложение не стартуем
  }

  // Бэкапам нужна таблица CronLease — стартуем только после успешных миграций.
  backup = backupScheduler.startBackupScheduler();

  let fails = 0;
  for (;;) {
    const startedAt = Date.now();
    // Приложение слушает внутренний APP_PORT — front проксирует на него.
    const app = await run(APP_CMD, { PORT: String(APP_PORT) });
    if (shuttingDown || app.signal) return; // graceful shutdown / убит сигналом
    if (app.code === 0) {
      cleanExit = true; // чистый выход приложения → выходим и мы
      return;
    }
    const ranMs = Date.now() - startedAt;
    fails = ranMs > HEALTHY_UPTIME_MS ? 1 : fails + 1;
    console.error(
      `[entrypoint] приложение упало (code=${app.code}, ranMs=${ranMs}, fails=${fails}/${MAX_FAILS})`,
    );
    if (fails >= MAX_FAILS) {
      console.error('[entrypoint] лимит перезапусков исчерпан — держу страницу техработ');
      return; // front остаётся на техработах
    }
    await sleep(BACKOFF_MS * fails);
    if (shuttingDown) return;
  }
}

main().then(() => {
  if (shuttingDown || cleanExit) finish();
  // Иначе (техработы) — процесс остаётся жив: front продолжает отдавать страницу.
});
