// Front на публичном порту (deploy/front-server.mjs). Держит порт 3000 всю жизнь
// контейнера: пока приложение не подняло внутренний APP_PORT — отдаёт страницу
// техработ (клиент не видит generic-503 Amvera); поднялось — прозрачно
// проксирует. Запускаем реальным процессом (как в контейнере): это
// dependency-free .mjs вне сборки Nest.
import { execFileSync, spawn, ChildProcess } from 'child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { createServer, request, Server } from 'http';
import { AddressInfo } from 'net';
import { tmpdir } from 'os';
import { join } from 'path';
import { PRACTICE_ALIAS_HOSTS } from '../practice-domain.middleware';

const FRONT = join(process.cwd(), 'deploy', 'front-server.mjs');
const FRONT_STATIC = join(process.cwd(), 'deploy', 'front-static.mjs');

// Поднимает front с заданным APP_PORT на эфемерном публичном порту (PORT=0),
// вычитывает реальный порт из лога. С distDir — через startFront() в
// инлайн-модуле: так спек подкладывает свою сборку визитки вместо webapp/dist.
function launchFront(appPort: number, distDir?: string) {
  const args = distDir
    ? [
        '--input-type=module',
        '-e',
        `import { startFront } from ${JSON.stringify(FRONT)};` +
          `startFront({ port: 0, appPort: ${appPort}, distDir: ${JSON.stringify(distDir)} });`,
      ]
    : [FRONT];
  const proc: ChildProcess = spawn('node', args, {
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

  describe('визитка в окне старта (хост решает: статика или техработы)', () => {
    let root: string;
    let dist: string;
    beforeAll(() => {
      root = mkdtempSync(join(tmpdir(), 'front-static-'));
      dist = join(root, 'dist');
      mkdirSync(join(dist, 'assets'), { recursive: true });
      writeFileSync(join(dist, 'index.html'), '<!doctype html>VISITKA-INDEX');
      writeFileSync(
        join(dist, 'assets', 'index-AbCdEf12.js'),
        'console.log(1)',
      );
      writeFileSync(join(dist, 'robots.txt'), 'PRODUCT-ROBOTS');
      writeFileSync(join(root, 'secret.txt'), 'SECRET');
    });
    afterAll(() => rmSync(root, { recursive: true, force: true }));

    // fetch не даёт подменить Host — сырой http.request.
    function hit(port: number, path: string, host: string, method = 'GET') {
      return new Promise<{ status: number; type: string; body: string }>(
        (resolve, reject) => {
          const req = request(
            { port, host: '127.0.0.1', path, method, headers: { Host: host } },
            (res) => {
              let body = '';
              res.on('data', (c: Buffer) => (body += c.toString()));
              res.on('end', () =>
                resolve({
                  status: res.statusCode ?? 0,
                  type: String(res.headers['content-type']),
                  body,
                }),
              );
            },
          );
          req.on('error', reject);
          req.end();
        },
      );
    }

    it('kotlarewski.gr: страницы — index.html, файлы сборки — с диска', async () => {
      const { proc, port } = launchFront(59998, dist);
      alive.push(proc);
      const p = await port;

      for (const path of ['/', '/book', '/articles/some-slug?utm=ad']) {
        const res = await hit(p, path, 'kotlarewski.gr');
        expect(res.status).toBe(200);
        expect(res.type).toContain('text/html');
        expect(res.body).toContain('VISITKA-INDEX');
      }
      const js = await hit(
        p,
        '/assets/index-AbCdEf12.js',
        'kotlarewski.gr:443',
      );
      expect(js.type).toContain('javascript');
      expect(js.body).toBe('console.log(1)');
      expect((await hit(p, '/nope.png', 'kotlarewski.gr')).status).toBe(404);
      // Выход из dist по закодированному «..» не читает соседний файл.
      const escape = await hit(p, '/..%2fsecret.txt', 'kotlarewski.gr');
      expect(escape.body).not.toContain('SECRET');
    }, 10000);

    it('продукт, API, /app, /health, robots и запись — техработы даже на визитке', async () => {
      const { proc, port } = launchFront(59997, dist);
      alive.push(proc);
      const p = await port;

      const cases: [string, string, string?][] = [
        ['/', 'schemehappens.ru'],
        ['/book', 'schemehappens.ru'],
        ['/api/booking/options', 'kotlarewski.gr'],
        ['/app', 'kotlarewski.gr'],
        ['/health', 'kotlarewski.gr'],
        ['/robots.txt', 'kotlarewski.gr'],
        ['/', 'kotlarewski.gr', 'POST'],
      ];
      for (const [path, host, method] of cases) {
        const res = await hit(p, path, host, method);
        expect(res.status).toBe(200);
        expect(res.body).toContain('технические работы');
        expect(res.body).not.toContain('VISITKA-INDEX');
      }
    }, 10000);

    it('сборки визитки нет → и на её хосте техработы, а не пустой ответ', async () => {
      const { proc, port } = launchFront(59996, join(root, 'missing'));
      alive.push(proc);
      const res = await hit(await port, '/', 'kotlarewski.gr');
      expect(res.body).toContain('технические работы');
    }, 10000);

    it('хосты визитки во front совпадают с PRACTICE_ALIAS_HOSTS (правило №4)', () => {
      const out = execFileSync('node', [
        '--input-type=module',
        '-e',
        `import { VISITKA_HOSTS } from ${JSON.stringify(FRONT_STATIC)};` +
          'console.log(JSON.stringify([...VISITKA_HOSTS]));',
      ]).toString();
      expect((JSON.parse(out) as string[]).sort()).toEqual(
        [...PRACTICE_ALIAS_HOSTS].sort(),
      );
    });
  });
});
