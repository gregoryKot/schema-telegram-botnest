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
// Ошибка биндинга уходит в reject: без обработчика 'error' EADDRINUSE
// прилетал необработанным событием и валил весь файл невнятным сообщением.
function listen(port = 0): { server: Server; port: Promise<number> } {
  const server = createServer((s) => s.end());
  const bound = new Promise<number>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () =>
      resolve((server.address() as AddressInfo).port),
    );
  });
  return { server, port: bound };
}

// Занимает эфемерный порт и сразу отпускает: ОС выдаёт номер, который прямо
// сейчас свободен. Нужно там, где порт требуется знать ДО того, как на нём
// кто-то слушает. Захардкоженная константа (было 58124) делала тест флаки —
// порт мог держать параллельный jest-воркер или сокет в TIME_WAIT.
async function reservePort(): Promise<number> {
  const { server, port } = listen();
  const p = await port;
  await new Promise<void>((r) => server.close(() => r()));
  return p;
}

const url = (port: number) => `postgresql://u:p@127.0.0.1:${port}/db`;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Бинд на ЗАДАННЫЙ порт с бюджетом ретраев. Между reservePort() и этим вызовом
// номер свободен для всей машины: его может занять и слушатель соседнего
// jest-воркера, и локальный порт исходящего соединения (таких в прогоне на
// порядки больше — каждый supertest-запрос берёт эфемерный порт). Одна попытка
// бинда и делала тест флаки: EADDRINUSE ронял джобу `backend` на посторонних
// PR (PR #542). Порт освобождается за миллисекунды, поэтому ждём его, а не
// сдаёмся с первого отказа.
async function listenWithRetry(port: number, attempts = 20): Promise<Server> {
  for (let i = 0; ; i++) {
    const { server, port: bound } = listen(port);
    try {
      await bound;
      return server;
    } catch (e) {
      server.close();
      if (i >= attempts || (e as NodeJS.ErrnoException).code !== 'EADDRINUSE')
        throw e;
      await wait(50);
    }
  }
}

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
    //
    // Зеркало той же гонки: порт от reservePort() пуст в момент выдачи, но за
    // 600мс бюджета на нём может подняться слушатель соседнего воркера — тогда
    // connect удастся, процесс выйдет с 0, и тест упадёт с другой стороны.
    // Держать порт «закрытым» нельзя: bind без listen в Node не выражается, а
    // слушающий сокет принимает соединение, как бы мы его потом ни рвали.
    // Поэтому нарушенное предусловие не замалчиваем, а переигрываем на новом
    // порту. Настоящий регресс (код 0 на реально пустом порту) даёт 0 на ВСЕХ
    // попытках — тест всё равно краснеет, просто на пару секунд позже.
    let code = 0;
    for (let i = 0; i < 5 && code !== 1; i++) {
      const run = runWait({
        DATABASE_URL: url(await reservePort()),
        DB_WAIT_INTERVAL_MS: '100',
        DB_WAIT_CONNECT_MS: '200',
        DB_WAIT_TIMEOUT_MS: '600',
      });
      alive.push(run.proc);
      code = await run.code;
    }
    expect(code).toBe(1);
  }, 20000);

  it('БД поднялась позже (та самая гонка старта) → ретраи дожидаются, код 0', async () => {
    // Порт известен заранее: стартуем ожидание ДО listener, поднимаем его
    // позже — ровно сценарий инцидента (приложение стартовало раньше
    // Postgres-пода).
    const PORT = await reservePort();
    const { proc, code } = runWait({
      DATABASE_URL: url(PORT),
      DB_WAIT_INTERVAL_MS: '150',
      DB_WAIT_CONNECT_MS: '300',
      DB_WAIT_TIMEOUT_MS: '8000',
    });
    alive.push(proc);
    await wait(600); // БД ещё «спит» — идут ретраи
    servers.push(await listenWithRetry(PORT)); // «под встал»
    expect(await code).toBe(0);
  }, 20000);

  it('нет DATABASE_URL → не блокирует старт, выходит с кодом 0', async () => {
    const { proc, code } = runWait({ DATABASE_URL: '' });
    alive.push(proc);
    expect(await code).toBe(0);
  }, 20000);
});
