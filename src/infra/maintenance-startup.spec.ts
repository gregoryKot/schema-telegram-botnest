// Супервизор старта (deploy/entrypoint.mjs): при ЛЮБОМ падении старта поднимает
// страницу техработ вместо выхода контейнера (иначе Amvera показывает 502).
// Гоняем реальным процессом, подсовывая фейковые команды через env (RECOVER_CMD/
// MIGRATE_CMD/APP_CMD), — как в контейнере, но без реальных prisma/node dist.
import { spawn, ChildProcess } from 'child_process';
import { join } from 'path';

const ENTRY = join(process.cwd(), 'deploy', 'entrypoint.mjs');

// Запускает entrypoint с фейковыми командами. Возвращает процесс и промис,
// который резолвится портом страницы техработ (если она поднялась) или null
// (если процесс завершился раньше — чистый старт без техработ).
function launch(env: Record<string, string>) {
  const proc: ChildProcess = spawn('node', [ENTRY], {
    env: { ...process.env, PORT: '0', ...env },
  });
  const port = new Promise<number | null>((resolve) => {
    let buf = '';
    proc.stderr?.on('data', (d: Buffer) => {
      buf += d.toString();
      const m = buf.match(/поднята на порту (\d+)/);
      if (m) resolve(Number(m[1]));
    });
    proc.on('exit', () => resolve(null)); // вышел без страницы техработ
  });
  return { proc, port };
}

describe('entrypoint (супервизор старта)', () => {
  const alive: ChildProcess[] = [];
  afterEach(() => {
    while (alive.length) alive.pop()?.kill('SIGKILL');
  });

  it('migrate deploy упал → страница техработ (200)', async () => {
    const { proc, port } = launch({
      RECOVER_CMD: 'true',
      MIGRATE_CMD: 'exit 1',
    });
    alive.push(proc);
    const p = await port;
    expect(p).not.toBeNull();
    const res = await fetch(`http://127.0.0.1:${p}/`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('технические работы');
  }, 10000);

  it('приложение крашится → после лимита перезапусков страница техработ', async () => {
    const { proc, port } = launch({
      RECOVER_CMD: 'true',
      MIGRATE_CMD: 'true',
      APP_CMD: 'exit 1',
      STARTUP_MAX_FAILS: '2',
      STARTUP_BACKOFF_MS: '10',
    });
    alive.push(proc);
    const p = await port;
    expect(p).not.toBeNull();
    const res = await fetch(`http://127.0.0.1:${p!}/`);
    expect(res.status).toBe(200);
  }, 10000);

  it('чистый старт (app завершился 0) → НЕ поднимает техработы, выходит 0', async () => {
    const { proc, port } = launch({
      RECOVER_CMD: 'true',
      MIGRATE_CMD: 'true',
      APP_CMD: 'exit 0',
    });
    alive.push(proc);
    const exitCode = await new Promise<number>((resolve) =>
      proc.on('exit', (c) => resolve(c ?? -1)),
    );
    expect(exitCode).toBe(0);
    expect(await port).toBeNull(); // страница техработ НЕ поднималась
  }, 10000);
});
