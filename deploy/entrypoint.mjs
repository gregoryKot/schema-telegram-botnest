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
// этом красный (Dockerfile смотрит тело /health, не код front). Каждый шаг
// пишет состояние (supervisor-status.mjs): front отдаёт его заголовком
// X-Maintenance-Reason, а парковка (migrate, лимит, БД) шлёт DM владельцу.
// Настройки из env — entrypoint-config.mjs.
//
// Graceful shutdown: Node как PID 1 ловит SIGTERM/SIGINT, пробрасывает их
// приложению (bot.stop, prisma disconnect), затем закрывает front и выходит.
import { spawn } from 'node:child_process';
import { startFront } from './front-server.mjs';
import backupScheduler from './backup-scheduler.cjs';
import { parseDbTarget, waitForDb } from './wait-for-db.mjs';
import { classifyAppExit, crashMessage, superviseSeries } from './app-exit.mjs';
import { createCrashBook } from './crash-window.mjs';
import { readEntrypointConfig } from './entrypoint-config.mjs';
import { createSupervisorStatus } from './supervisor-status.mjs';

// Публичный порт — здесь, а не в entrypoint-config.mjs: его сверяет с
// containerPort из amvera.yml гейт scripts/check-deploy-paths.mjs.
const PORT =
  process.env.PORT !== undefined && process.env.PORT !== ''
    ? Number(process.env.PORT)
    : 3000;
const C = readEntrypointConfig();
const book = createCrashBook({ windowMs: C.CRASH_WINDOW_MS, maxFails: C.MAX_FAILS, hourMaxFails: C.MAX_FAILS_HOUR });
const status = createSupervisorStatus({ token: C.BOT_TOKEN, chatId: C.ADMIN_ID, apiBase: C.ALERT_API });

// Front занимает публичный порт немедленно; приложение живёт на APP_PORT.
const front = startFront({ port: PORT, appPort: C.APP_PORT, reason: status.reason });

let current = null;
let shuttingDown = false;
let cleanExit = false;
let backup = null; // планировщик бэкапов в Yandex Object Storage (deploy/backup-scheduler.cjs)

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
    status.set('db-wait');
    const reachable = await waitForDb({
      target: dbTarget,
      timeoutMs: C.DB_WAIT_TIMEOUT_MS,
      intervalMs: C.DB_WAIT_INTERVAL_MS,
      connectTimeoutMs: C.DB_WAIT_CONNECT_MS,
      log: (m) => console.warn(m),
    });
    if (shuttingDown) return;
    if (!reachable) {
      void status.park('db-unreachable');
      return { reason: 'db', healthy: false };
    }
  }

  status.set('migrating');
  await run(C.RECOVER_CMD);
  if (shuttingDown) return;

  // migrate deploy с ретраями: открытый TCP не гарантирует готовность Postgres.
  // Битый SQL/P3009 ретраи не вылечат — лишь отложат техработы на backoff.
  let migrateOk = false;
  for (let attempt = 1; attempt <= C.MIGRATE_MAX_ATTEMPTS; attempt++) {
    const migrate = await run(C.MIGRATE_CMD);
    if (shuttingDown) return;
    if (!migrate.signal && migrate.code === 0) {
      migrateOk = true;
      break;
    }
    console.error(
      `[entrypoint] migrate deploy упал (попытка ${attempt}/${C.MIGRATE_MAX_ATTEMPTS}, code=${migrate.code})`,
    );
    if (attempt < C.MIGRATE_MAX_ATTEMPTS) await sleep(C.MIGRATE_BACKOFF_MS);
    if (shuttingDown) return;
  }
  if (!migrateOk) {
    console.error('[entrypoint] migrate deploy не прошёл — держу страницу техработ');
    void status.park('migrate-failed');
    return; // front уже отдаёт техработы; приложение не стартуем
  }

  // Бэкапам нужна таблица CronLease — стартуем только после успешных миграций.
  backup ??= backupScheduler.startBackupScheduler();

  book.newSeries();
  let healthy = false; // хоть раз прожило дольше окна → пауза не растёт
  for (;;) {
    const startedAt = Date.now();
    status.set('app-starting');
    // APP_PORT — внутренний, front проксирует; номер запуска и троттл DM — start-announce.ts.
    const app = await run(C.APP_CMD, { PORT: String(C.APP_PORT), ...book.launchEnv(startedAt) });
    const exit = classifyAppExit(app, shuttingDown);
    if (exit === 'stop') return; // graceful shutdown по нашему SIGTERM/SIGINT
    if (exit === 'clean') {
      cleanExit = true; // чистый выход приложения → выходим и мы
      return;
    }
    const ranMs = Date.now() - startedAt;
    if (ranMs >= C.CRASH_WINDOW_MS) healthy = true;
    const c = book.crash(Date.now());
    console.error(crashMessage(app, ranMs, c.fails, C.MAX_FAILS, c.note));
    if (c.limit) {
      void status.park('crashloop-parked'); // front на техработах
      return { reason: 'limit', healthy };
    }
    await sleep(C.BACKOFF_MS * c.fails);
    if (shuttingDown) return;
  }
}

const cfg = { base: C.COOLDOWN_MS, max: C.COOLDOWN_MAX_MS, sleep, log: console.error };
superviseSeries(main, { ...cfg, stopping: () => shuttingDown }).then(() => {
  if (shuttingDown || cleanExit) finish();
  // Иначе (парковка по migrate) — процесс жив: front отдаёт страницу.
});
