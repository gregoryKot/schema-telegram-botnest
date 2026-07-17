// Front на публичном порту (deploy/front-server.mjs). Держит порт 3000 всю жизнь
// контейнера: пока приложение не подняло внутренний APP_PORT — отдаёт страницу
// техработ (клиент не видит generic-503 Amvera); поднялось — прозрачно
// проксирует. Запускаем реальным процессом (как в контейнере): это
// dependency-free .mjs вне сборки Nest.
import { spawn, ChildProcess } from 'child_process';
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { join } from 'path';

const FRONT = join(process.cwd(), 'deploy', 'front-server.mjs');

// Поднимает front с заданным APP_PORT на эфемерном публичном порту (PORT=0),
// вычитывает реальный порт из лога.
function launchFront(appPort: number) {
  const proc: ChildProcess = spawn('node', [FRONT], {
    env: { ...process.env, PORT: '0', APP_PORT: String(appPort) },
  });
  const port = new Promise<number>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('front не поднялся за 5с')),
      5000,
    );
    proc.stderr?.on('data', (buf: Buffer) => {
      const m = buf.toString().match(/поднят на порту (\d+)/);
      if (m) {
        clearTimeout(timer);
        resolve(Number(m[1]));
      }
    });
    proc.on('error', reject);
  });
  return { proc, port };
}

describe('front-server (публичный порт: техработы ⇄ проброс)', () => {
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

  it('приложение не поднято → страница техработ 200 на любом маршруте', async () => {
    // APP_PORT указывает в никуда (нет апстрима).
    const { proc, port } = launchFront(59999);
    alive.push(proc);
    const frontPort = await port;

    for (const path of ['/', '/app', '/api/settings', '/health']) {
      const res = await fetch(`http://127.0.0.1:${frontPort}${path}`);
      expect(res.status).toBe(200);
      expect(res.headers.get('cache-control')).toContain('no-store');
      expect(res.headers.get('content-type')).toContain('text/html');
      const html = await res.text();
      expect(html).toContain('технические работы');
      expect(html).toContain('Всё по схеме');
    }
  }, 10000);

  it('приложение слушает APP_PORT → front прозрачно проксирует (не техработы)', async () => {
    // Фейковый апстрим «приложения».
    const upstream = createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, path: req.url }));
    });
    servers.push(upstream);
    const upstreamPort = await new Promise<number>((resolve) =>
      upstream.listen(0, '127.0.0.1', () =>
        resolve((upstream.address() as AddressInfo).port),
      ),
    );

    const { proc, port } = launchFront(upstreamPort);
    alive.push(proc);
    const frontPort = await port;

    const res = await fetch(`http://127.0.0.1:${frontPort}/api/thing`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.json()).toEqual({ ok: true, path: '/api/thing' });
  }, 10000);

  it('старт: сперва техработы, апстрим поднялся позже → далее проброс (окно старта закрыто)', async () => {
    // Фиксированный локальный порт под будущий апстрим (эфемерный не подойдёт —
    // front надо стартовать до апстрима, зная его порт заранее).
    const APP_PORT = 58123;
    const { proc, port } = launchFront(APP_PORT);
    alive.push(proc);
    const frontPort = await port;

    // Апстрима ещё нет — техработы.
    const before = await fetch(`http://127.0.0.1:${frontPort}/`);
    expect(await before.text()).toContain('технические работы');

    // Приложение «поднялось».
    const upstream = createServer((_req, res) => res.end('APP-UP'));
    servers.push(upstream);
    await new Promise<void>((r) =>
      upstream.listen(APP_PORT, '127.0.0.1', () => r()),
    );

    // Новое соединение уже проксируется на приложение.
    const after = await fetch(`http://127.0.0.1:${frontPort}/`);
    expect(await after.text()).toBe('APP-UP');
  }, 10000);
});
