// HEALTHCHECK образа (Dockerfile) смотрит на тело /health, а не на код ответа.
// Аудит 2026-10-11 (infra#13): front (deploy/front-server.mjs) отвечает 200
// страницей техработ на ЛЮБОЙ путь, включая /health, а проверка была `r.ok` —
// запаркованный на техработах контейнер считался здоровым.
//
// Шов (правило №14): команда читается из настоящего Dockerfile и исполняется
// через `sh -c`, как её исполняет Docker, против настоящего front-server.mjs;
// здоровое тело — настоящий отчёт HealthController, а не сочинённая строка
// (правило №23). Контрольные образцы: здоровый ответ и 503 от апстрима.
import { ChildProcess, execFile, spawn } from 'child_process';
import { readFileSync } from 'fs';
import { createServer, Server } from 'http';
import { createServer as createTcp } from 'net';
import { join } from 'path';
import { HealthController } from '../api/health.controller';
import { PrismaService } from '../prisma/prisma.service';

const ROOT = join(__dirname, '..', '..');
const DOCKERFILE = readFileSync(join(ROOT, 'Dockerfile'), 'utf8');
const MARKER = '"status":"ok"';

/** Команда из `HEALTHCHECK … CMD <команда>` с склейкой `\`-продолжений. */
function healthcheckCommand(): string {
  const joined = DOCKERFILE.replace(/\\\r?\n/g, ' ');
  const line = joined.split('\n').find((l) => l.startsWith('HEALTHCHECK'));
  if (!line) throw new Error('в Dockerfile нет HEALTHCHECK');
  const m = line.match(/\sCMD\s+(.*)$/);
  if (!m) throw new Error('у HEALTHCHECK нет CMD');
  return m[1].trim();
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createTcp();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      srv.close(() => (port ? resolve(port) : reject(new Error('нет порта'))));
    });
  });
}

/** Исполняет команду HEALTHCHECK как Docker; отдаёт её код выхода. */
function runHealthcheck(port: number): Promise<number> {
  return new Promise((resolve) => {
    execFile(
      'sh',
      ['-c', healthcheckCommand()],
      { env: { ...process.env, PORT: String(port) }, timeout: 8000 },
      (err) => {
        const code = (err as { code?: number | string } | null)?.code;
        resolve(err ? (typeof code === 'number' ? code : 1) : 0);
      },
    );
  });
}

describe('Dockerfile HEALTHCHECK', () => {
  const procs: ChildProcess[] = [];
  const servers: Server[] = [];
  afterEach(async () => {
    for (const p of procs.splice(0)) p.kill('SIGKILL');
    await Promise.all(
      servers.splice(0).map((s) => new Promise((r) => s.close(r))),
    );
  });

  /** Настоящий front на свободном порту, апстрим — appPort. */
  async function startFront(appPort: number): Promise<number> {
    const port = await freePort();
    const proc = spawn('node', [join(ROOT, 'deploy', 'front-server.mjs')], {
      env: { ...process.env, PORT: String(port), APP_PORT: String(appPort) },
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    procs.push(proc);
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('front не поднялся')), 5000);
      proc.stderr?.on('data', (d: Buffer) => {
        if (/поднят на порту/.test(d.toString())) {
          clearTimeout(t);
          resolve();
        }
      });
    });
    return port;
  }

  /** Фейковое приложение: на /health отдаёт status и тело. */
  async function startUpstream(status: number, body: string): Promise<number> {
    const port = await freePort();
    const srv = createServer((_q, s) => {
      s.writeHead(status, { 'content-type': 'application/json' });
      s.end(body);
    });
    servers.push(srv);
    await new Promise<void>((r) => srv.listen(port, '127.0.0.1', r));
    return port;
  }

  const healthyPrisma = {
    $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
  } as unknown as PrismaService;

  it('приложение не поднято, front отдаёт техработы (200) → HEALTHCHECK красный', async () => {
    const port = await startFront(await freePort()); // апстрима нет
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    expect(res.status).toBe(200); // именно поэтому `r.ok` не годился
    expect(await res.text()).not.toContain(MARKER);
    expect(await runHealthcheck(port)).not.toBe(0);
  }, 20000);

  it('здоровый отчёт HealthController через front → HEALTHCHECK зелёный', async () => {
    const report = await new HealthController(healthyPrisma).check();
    const body = JSON.stringify(report);
    expect(body).toContain(MARKER); // маркер — свойство настоящего отчёта
    const port = await startFront(await startUpstream(200, body));
    expect(await runHealthcheck(port)).toBe(0);
  }, 20000);

  it('контроль: приложение живо, но БД лежит (503 error/down) → HEALTHCHECK красный', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockRejectedValue(new Error('db down')),
    } as unknown as PrismaService;
    const err = await new HealthController(prisma)
      .check()
      .catch((e: { getStatus(): number; getResponse(): unknown }) => e);
    const port = await startFront(
      await startUpstream(
        (err as { getStatus(): number }).getStatus(),
        JSON.stringify((err as { getResponse(): unknown }).getResponse()),
      ),
    );
    expect(await runHealthcheck(port)).not.toBe(0);
  }, 20000);

  it('никто не слушает порт → HEALTHCHECK красный', async () => {
    expect(await runHealthcheck(await freePort())).not.toBe(0);
  }, 20000);

  // Правило №4: один маркер в трёх местах, обязанных совпадать.
  it('маркер "status":"ok" одинаков в Dockerfile, ops.sh health_wait и prod-smoke.yml', () => {
    const ops = readFileSync(join(ROOT, 'deploy/vps/ops.sh'), 'utf8');
    const smoke = readFileSync(
      join(ROOT, '.github/workflows/prod-smoke.yml'),
      'utf8',
    );
    expect(healthcheckCommand().replace(/\\"/g, '"')).toContain(MARKER);
    expect(ops).toContain(MARKER);
    expect(smoke).toContain(MARKER);
  });
});
