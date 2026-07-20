// Ожидание готовности БД перед migrate deploy (deploy/wait-for-db.mjs).
//
// Инцидент 2026-07-20: при рестарте контейнера Postgres-под Amvera (CNPG)
// поднимался медленнее приложения; `migrate deploy` падал с P1001 (БД
// недоступна) и entrypoint НАВСЕГДА парковался на странице техработ, хотя
// схема цела (лечилось ручным рестартом). Фикс — ждать доступности TCP-порта
// БД (ровно то, что даёт P1001) с ретраями, и только потом мигрировать.
//
// Запускаем реальным процессом (как в контейнере) — это dependency-free .mjs
// вне сборки Nest, ESM в jest напрямую не импортируется (ср. front-server.spec).
import { spawn, ChildProcess } from 'child_process';
import { createServer, Server, AddressInfo } from 'net';
import { join } from 'path';

const WAIT = join(process.cwd(), 'deploy', 'wait-for-db.mjs');

// Запускает wait-for-db.mjs с заданным env; резолвит код выхода процесса.
function runWait(env: Record<string, string>): {
  proc: ChildProcess;
  code: Promise<number>;
} {
  const proc = spawn('node', [WAIT], { env: { ...process.env, ...env } });
  const code = new Promise<number>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('wait-for-db не завершился за 15с')),
      15000,
    );
    proc.on('exit', (c) => {
      clearTimeout(timer);
      resolve(c ?? -1);
    });
    proc.on('error', reject);
  });
  return { proc, code };
}

// Поднимает TCP-listener (127.0.0.1) на заданном (или эфемерном) порту.
function listen(port = 0): { server: Server; port: Promise<number> } {
  const server = createServer((s) => s.end());
  const bound = new Promise<number>((resolve) =>
    server.listen(port, '127.0.0.1', () =>
      resolve((server.address() as AddressInfo).port),
    ),
  );
  return { server, port: bound };
}

const url = (port: number) => `postgresql://u:p@127.0.0.1:${port}/db`;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('wait-for-db (ждём готовности БД перед migrate deploy)', () => {
  const alive: ChildProcess[] = [];
  const servers: Server[] = [];
  afterEach(async () => {
    while (alive.length) alive.pop()?.kill('SIGKILL');
    await Promise.all(
      servers
        .splice(0)
        .map((s) => new Promise<void>((r) => s.close(() => r()))),
    );
  });

  it('БД доступна сразу → процесс выходит с кодом 0', async () => {
    const { server, port } = listen();
    servers.push(server);
    const p = await port;
    const { proc, code } = runWait({
      DATABASE_URL: url(p),
      DB_WAIT_INTERVAL_MS: '100',
      DB_WAIT_TIMEOUT_MS: '5000',
    });
    alive.push(proc);
    expect(await code).toBe(0);
  }, 20000);

  it('БД недоступна за отведённый бюджет → выходит с кодом 1 (не виснет)', async () => {
    // Порт, где никто не слушает (connect → ECONNREFUSED), маленький таймаут.
    const { proc, code } = runWait({
      DATABASE_URL: url(59999),
      DB_WAIT_INTERVAL_MS: '100',
      DB_WAIT_CONNECT_MS: '200',
      DB_WAIT_TIMEOUT_MS: '600',
    });
    alive.push(proc);
    expect(await code).toBe(1);
  }, 20000);

  it('БД поднялась позже (та самая гонка старта) → ретраи дожидаются, код 0', async () => {
    // Фиксированный порт: стартуем ожидание ДО listener, поднимаем его позже —
    // ровно сценарий инцидента (приложение стартовало раньше Postgres-пода).
    const PORT = 58124;
    const { proc, code } = runWait({
      DATABASE_URL: url(PORT),
      DB_WAIT_INTERVAL_MS: '150',
      DB_WAIT_CONNECT_MS: '300',
      DB_WAIT_TIMEOUT_MS: '8000',
    });
    alive.push(proc);
    await wait(600); // БД ещё «спит» — идут ретраи
    const { server } = listen(PORT); // «под встал»
    servers.push(server);
    expect(await code).toBe(0);
  }, 20000);

  it('нет DATABASE_URL → не блокирует старт, выходит с кодом 0', async () => {
    const { proc, code } = runWait({ DATABASE_URL: '' });
    alive.push(proc);
    expect(await code).toBe(0);
  }, 20000);
});
