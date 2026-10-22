// Точка входа контейнера (Dockerfile CMD). Node-супервизор старта.
//
// Публичный порт 3000 с ПЕРВОЙ секунды держит front (deploy/front-server.mjs),
// приложение слушает внутренний APP_PORT. Пока идёт старт (recover → migrate →
// буст Nest) или крашлуп, клиент видит нашу страницу техработ, а не generic-503
// Amvera; поднялось — front проксирует. Окна с пустым портом нет.
//
// Логика: front сразу (владеет портом 3000) → ожидание БД → recover-p3009 →
// migrate deploy (упал → техработы навсегда: повтор неидемпотентной миграции
// задваивает DML, лечится руками) → node dist/main на APP_PORT с лимитом
// падений за окно (crash-window.mjs) → планировщик бэкапов. Лимит исчерпан или
// БД не поднялась → техработы, пауза (cooldownMs) и новая серия: HEALTHCHECK при
// этом красный (Dockerfile смотрит тело /health, не код front).
//
// Graceful shutdown: Node как PID 1 ловит SIGTERM/SIGINT, пробрасывает их
// приложению (bot.stop, prisma disconnect), затем закрывает front и выходит.
import { spawn } from 'node:child_process';
import { startFront } from './front-server.mjs';
import backupScheduler from './backup-scheduler.cjs';
import { parseDbTarget, waitForDb } from './wait-for-db.mjs';
import { classifyAppExit, crashMessage, superviseSeries } from './app-exit.mjs';
import { crashesInWindow, validWindowMs } from './crash-window.mjs';

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
// Пауза между сериями после исчерпанного лимита (×2 до потолка).
const COOLDOWN_MS = Number(process.env.STARTUP_COOLDOWN_MS ?? 300000);
const COOLDOWN_MAX_MS = Number(process.env.STARTUP_COOLDOWN_MAX_MS ?? 3600000);
// Ожидание готовности БД перед миграциями (инцидент 2026-07-20, см.
// wait-for-db.mjs) и ретраи migrate deploy на окне инициализации Postgres.
const DB_WAIT_TIMEOUT_MS = Number(process.env.DB_WAIT_TIMEOUT_MS ?? 120000);
const DB_WAIT_INTERVAL_MS = Number(process.env.DB_WAIT_INTERVAL_MS ?? 2000);
const DB_WAIT_CONNECT_MS = Number(process.env.DB_WAIT_CONNECT_MS ?? 3000);
const MIGRATE_MAX_ATTEMPTS = Number(process.env.MIGRATE_MAX_ATTEMPTS ?? 3);
const MIGRATE_BACKOFF_MS = Number(process.env.MIGRATE_BACKOFF_MS ?? 3000);
// Окно счётчика падений (15 мин): MAX_FAILS падений за окно — лимит серии.
const CRASH_WINDOW_MS = validWindowMs(process.env.STARTUP_CRASH_WINDOW_MS, 900000);

// Front занимает публичный порт немедленно; приложение живёт на APP_PORT.
const front = startFront({ port: PORT, appPort: APP_PORT });

let current = null;
let shuttingDown = false;
let cleanExit = false;
let backup = null; // планировщик бэкапов в R2 (deploy/backup-scheduler.cjs)
let launches = 0; // номер запуска приложения в контейнере → STARTUP_LAUNCH

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
    // Есть живой ребёнок → пробрасываем сигнал (graceful shutdown), закроемся
    // в main() после его выхода. Нет ребёнка (техработы, пауза) → закрываемся сами.
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

// Одна серия. { reason: 'limit' | 'db', healthy } — исчерпана, superviseSeries
// выдержит паузу и начнёт новую; undefined — завершение или парковка по migrate.
async function main() {
  // Ждём TCP-порт БД перед recover/migrate: CNPG поднимается медленнее
  // приложения, migrate падал с P1001 (инцидент 2026-07-20).
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
    if (!reachable) return { reason: 'db', healthy: false };
  }

  await run(RECOVER_CMD);
  if (shuttingDown) return;

  // migrate deploy с ретраями: открытый TCP не гарантирует готовность Postgres.
  // Битый SQL/P3009 ретраи не вылечат — лишь отложат техработы на backoff.
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
  backup ??= backupScheduler.startBackupScheduler();

  let crashes = []; // метки падений этой серии, только внутри окна
  let healthy = false; // хоть раз прожило дольше окна → пауза не растёт
  for (;;) {
    const startedAt = Date.now();
    // APP_PORT — внутренний, front проксирует; номер запуска — для start-announce.ts.
    const app = await run(APP_CMD, { PORT: String(APP_PORT), STARTUP_LAUNCH: String(++launches) });
    const exit = classifyAppExit(app, shuttingDown);
    if (exit === 'stop') return; // graceful shutdown по нашему SIGTERM/SIGINT
    if (exit === 'clean') {
      cleanExit = true; // чистый выход приложения → выходим и мы
      return;
    }
    const ranMs = Date.now() - startedAt;
    if (ranMs >= CRASH_WINDOW_MS) healthy = true;
    crashes = crashesInWindow(crashes, Date.now(), CRASH_WINDOW_MS);
    const fails = crashes.length;
    console.error(crashMessage(app, ranMs, fails, MAX_FAILS));
    if (fails >= MAX_FAILS) return { reason: 'limit', healthy }; // front на техработах
    await sleep(BACKOFF_MS * fails);
    if (shuttingDown) return;
  }
}

const cfg = { base: COOLDOWN_MS, max: COOLDOWN_MAX_MS, sleep, log: console.error };
superviseSeries(main, { ...cfg, stopping: () => shuttingDown }).then(() => {
  if (shuttingDown || cleanExit) finish();
  // Иначе (парковка по migrate) — процесс жив: front отдаёт страницу.
});
