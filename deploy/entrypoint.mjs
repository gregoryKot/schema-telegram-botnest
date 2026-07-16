// Точка входа контейнера (Dockerfile CMD). Заменяет прежний sh-one-liner, чтобы
// при ЛЮБОМ падении старта показать страницу техработ вместо generic-ошибки
// Amvera (502) — а не только при падении миграции.
//
// Логика:
//   1. recover-p3009 (идемпотентно, ошибки игнорируем);
//   2. migrate deploy — упал → сразу страница техработ;
//   3. node dist/main — с ограниченным числом перезапусков (транзиентный краш
//      восстанавливается сам); исчерпали лимит → страница техработ.
//
// Graceful shutdown сохранён: это Node как PID 1, он ловит SIGTERM/SIGINT и
// пробрасывает их текущему дочернему процессу (app делает bot.stop, prisma
// disconnect), затем выходит. Прежний `exec node dist/main` этого не терял —
// здесь тоже не теряем, но добавляем фолбэк, которого exec не позволял.
//
// Команды вынесены в env (с прод-дефолтами) — это делает поведение тестируемым
// (src/infra/maintenance-startup.spec.ts подсовывает фейковые команды).
import { spawn } from 'node:child_process';
import { startMaintenanceServer } from './maintenance-server.mjs';

const PORT =
  process.env.PORT !== undefined && process.env.PORT !== ''
    ? Number(process.env.PORT)
    : 3000;
const RECOVER_CMD =
  process.env.RECOVER_CMD ??
  'npx prisma db execute --file prisma/recover-p3009.sql || true';
const MIGRATE_CMD = process.env.MIGRATE_CMD ?? 'npx prisma migrate deploy';
// exec — чтобы внутри sh -c процессом стал сам node и SIGTERM дошёл до него.
const APP_CMD = process.env.APP_CMD ?? 'exec node dist/main';
const MAX_FAILS = Number(process.env.STARTUP_MAX_FAILS ?? 3);
const BACKOFF_MS = Number(process.env.STARTUP_BACKOFF_MS ?? 2000);
// Проработал дольше — считаем следующий краш «свежим», а не частью крашлупа.
const HEALTHY_UPTIME_MS = Number(process.env.STARTUP_HEALTHY_MS ?? 60000);

let current = null;
let shuttingDown = false;

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    shuttingDown = true;
    // Есть живой ребёнок (app) → пробрасываем сигнал для graceful shutdown.
    // Нет (идёт страница техработ или пауза) → выходим сами.
    if (current && !current.killed) current.kill(sig);
    else process.exit(0);
  });
}

function run(cmdStr) {
  return new Promise((resolve) => {
    const child = spawn('sh', ['-c', cmdStr], { stdio: 'inherit' });
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
  await run(RECOVER_CMD);
  if (shuttingDown) return;

  const migrate = await run(MIGRATE_CMD);
  if (shuttingDown) return;
  if (migrate.signal || migrate.code !== 0) {
    console.error('[entrypoint] migrate deploy не прошёл — поднимаю страницу техработ');
    startMaintenanceServer(PORT);
    return;
  }

  let fails = 0;
  for (;;) {
    const startedAt = Date.now();
    const app = await run(APP_CMD);
    if (shuttingDown || app.signal) return; // graceful shutdown / убит сигналом
    if (app.code === 0) return; // чистый выход
    const ranMs = Date.now() - startedAt;
    fails = ranMs > HEALTHY_UPTIME_MS ? 1 : fails + 1;
    console.error(
      `[entrypoint] приложение упало (code=${app.code}, ranMs=${ranMs}, fails=${fails}/${MAX_FAILS})`,
    );
    if (fails >= MAX_FAILS) {
      console.error('[entrypoint] лимит перезапусков исчерпан — поднимаю страницу техработ');
      startMaintenanceServer(PORT);
      return;
    }
    await sleep(BACKOFF_MS * fails);
    if (shuttingDown) return;
  }
}

main();
