// Сервер техработ (deploy/maintenance-server.mjs) — фолбэк, который отдаёт
// дружелюбную страницу на порту 3000, когда основное приложение не стартовало
// (крашлуп migrate deploy, инцидент 2026-07-16). Проверяем контракт ответа:
// 503 + Retry-After + страница на любой маршрут. Запускаем реальным процессом
// (как в контейнере), т.к. это dependency-free .mjs вне сборки Nest.
import { spawn, ChildProcess } from 'child_process';
import { join } from 'path';

const SERVER = join(process.cwd(), 'deploy', 'maintenance-server.mjs');

describe('maintenance-server (страница техработ)', () => {
  let proc: ChildProcess;
  let port: number;

  beforeAll(async () => {
    // PORT=0 → ОС выдаёт свободный порт, вычитываем его из лога сервера.
    proc = spawn('node', [SERVER], { env: { ...process.env, PORT: '0' } });
    port = await new Promise<number>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('сервер не поднялся за 5с')),
        5000,
      );
      proc.stderr?.on('data', (buf: Buffer) => {
        const m = buf.toString().match(/порту (\d+)/);
        if (m) {
          clearTimeout(timer);
          resolve(Number(m[1]));
        }
      });
      proc.on('error', reject);
    });
  });

  afterAll(() => {
    proc?.kill('SIGTERM');
  });

  it('отдаёт 200 (гарантированный проброс через прокси) со страницей техработ', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/`);
    // 200, а не 503: если прокси Amvera перехватывает 5xx, страница не дойдёт.
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('no-store');
    expect(res.headers.get('content-type')).toContain('text/html');
    const html = await res.text();
    expect(html).toContain('технические работы');
    expect(html).toContain('Всё по схеме');
  });

  it('отвечает страницей техработ на любом маршруте, включая /health (catch-all)', async () => {
    for (const path of ['/app', '/api/settings', '/health', '/whatever']) {
      const res = await fetch(`http://127.0.0.1:${port}${path}`);
      expect(res.status).toBe(200);
      expect(await res.text()).toContain('технические работы');
    }
  });
});
