// Ждём готовности БД, ПЕРЕД тем как гнать recover-p3009 / migrate deploy.
//
// Зачем (инцидент 2026-07-20): при рестарте контейнера Postgres-под Amvera
// (CNPG) поднимается медленнее приложения. `migrate deploy`, запущенный раньше
// готовности БД, падал с P1001 (Can't reach database server), и entrypoint
// НАВСЕГДА парковался на странице техработ — хотя схема цела, а БД просто ещё
// не проснулась (лечилось ручным рестартом: ко второй попытке под успевал
// встать). P1001 — это ровно отказ TCP-connect, поэтому проверяем именно
// доступность порта БД и ждём с ретраями. Настоящие ошибки миграции (битый
// SQL, P3009) сюда не попадают — они дают ненулевой код уже при живой БД и
// по-прежнему держат техработы (крашлуп по битой схеме нам не нужен).
//
// Зависимостей нет намеренно (как front-server.mjs): только встроенные модули
// Node — ожидание обязано работать, даже если сломаны зависимости приложения.
import { connect } from 'node:net';

const DEFAULT_PG_PORT = 5432;

// Достаём host:port из DATABASE_URL. Возвращаем null, если URL нет/битый —
// вызывающая сторона решит, что делать (не блокировать старт: migrate deploy
// сам выдаст понятную ошибку про конфиг).
export function parseDbTarget(databaseUrl) {
  if (!databaseUrl) return null;
  try {
    const u = new URL(databaseUrl);
    const host = u.hostname;
    if (!host) return null;
    const port = u.port ? Number(u.port) : DEFAULT_PG_PORT;
    if (!Number.isInteger(port) || port <= 0) return null;
    return { host, port };
  } catch {
    return null;
  }
}

// Одна попытка TCP-connect к БД. Резолвится true при успешном соединении,
// false при отказе/недоступности/таймауте (ровно то, что порождает P1001).
export function probeTcp({ host, port, connectTimeoutMs = 3000 }) {
  return new Promise((resolve) => {
    const socket = connect({ host, port });
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(connectTimeoutMs, () => finish(false));
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Опрашиваем БД, пока не начнёт принимать соединения или пока не выйдет бюджет
// времени. true — БД доступна; false — не поднялась за timeoutMs.
// Зависимости (probe/now/log) инъектируются — для тестов и переиспользования.
export async function waitForDb({
  target,
  timeoutMs = 120000,
  intervalMs = 2000,
  connectTimeoutMs = 3000,
  probe = probeTcp,
  now = () => Date.now(),
  log = () => {},
} = {}) {
  if (!target) return false;
  const start = now();
  let attempt = 0;
  for (;;) {
    attempt += 1;
    if (await probe({ host: target.host, port: target.port, connectTimeoutMs })) {
      log(
        `[wait-for-db] БД доступна (${target.host}:${target.port}, попытка ${attempt})`,
      );
      return true;
    }
    if (now() - start >= timeoutMs) {
      log(
        `[wait-for-db] БД недоступна за ${timeoutMs}мс (${attempt} попыток) — сдаюсь`,
      );
      return false;
    }
    log(
      `[wait-for-db] БД ещё не готова (${target.host}:${target.port}, попытка ${attempt}), жду ${intervalMs}мс`,
    );
    await sleep(intervalMs);
  }
}

// CLI: `node deploy/wait-for-db.mjs` → exit 0 при готовности БД, 1 при таймауте.
// Параметры — через env (те же имена читает entrypoint при импорте функций).
if (process.argv[1] && process.argv[1].endsWith('wait-for-db.mjs')) {
  const target = parseDbTarget(process.env.DATABASE_URL);
  if (!target) {
    console.warn('[wait-for-db] DATABASE_URL не задан/битый — пропускаю ожидание');
    process.exit(0);
  }
  const ok = await waitForDb({
    target,
    timeoutMs: Number(process.env.DB_WAIT_TIMEOUT_MS ?? 120000),
    intervalMs: Number(process.env.DB_WAIT_INTERVAL_MS ?? 2000),
    connectTimeoutMs: Number(process.env.DB_WAIT_CONNECT_MS ?? 3000),
    log: (m) => console.warn(m),
  });
  process.exit(ok ? 0 : 1);
}
