// Супервизор старта (deploy/entrypoint.mjs). Публичный порт держит front с первой
// секунды: пока приложение не подняло внутренний APP_PORT (окно старта, провал
// migrate, крашлуп) — клиент видит страницу техработ, а не generic-503 Amvera;
// приложение поднялось — front проксирует на него. Гоняем реальным процессом,
// подсовывая фейковые команды через env (RECOVER_CMD/MIGRATE_CMD/APP_CMD).
import { spawn, ChildProcess } from 'child_process';
import { join } from 'path';

const ENTRY = join(process.cwd(), 'deploy', 'entrypoint.mjs');

// Запускает entrypoint с фейковыми командами. front всегда поднимается на PORT=0
// (эфемерный) — возвращаем промис его порта (из лога) и промис exit-кода.
function launch(env: Record<string, string>) {
  const proc: ChildProcess = spawn('node', [ENTRY], {
    env: { ...process.env, PORT: '0', ...env },
  });
  const frontPort = new Promise<number>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('front не поднялся за 5с')),
      5000,
    );
    let buf = '';
    proc.stderr?.on('data', (d: Buffer) => {
      buf += d.toString();
      const m = buf.match(/поднят на порту (\d+)/);
      if (m) {
        clearTimeout(timer);
        resolve(Number(m[1]));
      }
    });
    proc.on('exit', () =>
      reject(new Error('процесс вышел раньше, чем поднялся front')),
    );
  });
  const exit = new Promise<number>((resolve) =>
    proc.on('exit', (c) => resolve(c ?? -1)),
  );
  return { proc, frontPort, exit };
}

async function poll(url: string, want: RegExp, tries = 40): Promise<string> {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      const text = await res.text();
      if (want.test(text)) return text;
    } catch {
      /* front ещё не принимает — повторим */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`не дождались ${want} по ${url}`);
}

describe('entrypoint (супервизор старта)', () => {
  const alive: ChildProcess[] = [];
  afterEach(() => {
    while (alive.length) alive.pop()?.kill('SIGKILL');
  });

  it('migrate deploy упал → front держит страницу техработ (200)', async () => {
    const { proc, frontPort } = launch({
      RECOVER_CMD: 'true',
      MIGRATE_CMD: 'exit 1',
      APP_PORT: '59998', // апстрима нет
    });
    alive.push(proc);
    const port = await frontPort;
    const res = await fetch(`http://127.0.0.1:${port}/`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('технические работы');
  }, 10000);

  it('приложение крашится → после лимита перезапусков front держит техработы', async () => {
    const { proc, frontPort } = launch({
      RECOVER_CMD: 'true',
      MIGRATE_CMD: 'true',
      APP_CMD: 'exit 1',
      APP_PORT: '59997', // апстрим так и не поднимется
      STARTUP_MAX_FAILS: '2',
      STARTUP_BACKOFF_MS: '10',
    });
    alive.push(proc);
    const port = await frontPort;
    const text = await poll(`http://127.0.0.1:${port}/`, /технические работы/);
    expect(text).toContain('технические работы');
  }, 10000);

  it('приложение подняло APP_PORT → front проксирует на него (не техработы)', async () => {
    const APP_PORT = '58124';
    const { proc, frontPort } = launch({
      RECOVER_CMD: 'true',
      MIGRATE_CMD: 'true',
      // Приложение слушает process.env.PORT — entrypoint выставляет его в APP_PORT.
      APP_CMD:
        "node -e \"require('http').createServer((_q,s)=>s.end('APP-LIVE')).listen(process.env.PORT)\"",
      APP_PORT,
    });
    alive.push(proc);
    const port = await frontPort;
    const text = await poll(`http://127.0.0.1:${port}/`, /APP-LIVE/);
    expect(text).toBe('APP-LIVE');
  }, 10000);

  it('чистый старт (app завершился 0) → контейнер выходит 0', async () => {
    const { proc, exit } = launch({
      RECOVER_CMD: 'true',
      MIGRATE_CMD: 'true',
      APP_CMD: 'exit 0',
      APP_PORT: '59996',
    });
    alive.push(proc);
    expect(await exit).toBe(0);
  }, 10000);
});
