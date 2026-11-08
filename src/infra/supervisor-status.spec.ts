// deploy/supervisor-status.mjs — состояние супервизора старта для front
// (заголовок X-Maintenance-Reason; аудит 2026-10, «Красный смок не говорит, что
// именно лежит») и deploy/entrypoint-config.mjs — настройки из env. Шов с
// настоящим entrypoint — maintenance-startup.spec.ts.
import { execFileSync } from 'child_process';
import { join } from 'path';

const STATUS = join(process.cwd(), 'deploy', 'supervisor-status.mjs');
const CONFIG = join(process.cwd(), 'deploy', 'entrypoint-config.mjs');

/** Сценарий над настоящим .mjs в отдельном node (jest ESM не грузит). */
function scenario<T>(body: string): T {
  const src = `import * as m from ${JSON.stringify(STATUS)};
const out = await (async () => { ${body} })();
process.stdout.write(JSON.stringify(out));`;
  const raw = execFileSync(process.execPath, [
    '--input-type=module',
    '-e',
    src,
  ]);
  return JSON.parse(raw.toString()) as T;
}

describe('deploy/supervisor-status.mjs', () => {
  it('set меняет причину для front, начальная — starting', () => {
    const out = scenario<string[]>(`
      const s = m.createSupervisorStatus({});
      const before = s.reason();
      s.set('migrating');
      return [before, s.reason()];`);
    expect(out).toEqual(['starting', 'migrating']);
  });

  it('парковка ставит свою причину', () => {
    const out = scenario<string>(`
      const s = m.createSupervisorStatus({});
      await s.park('migrate-failed');
      return s.reason();`);
    expect(out).toBe('migrate-failed');
  });
});

describe('deploy/entrypoint-config.mjs', () => {
  function read(env: Record<string, string>): Record<string, unknown> {
    const src = `import { readEntrypointConfig } from ${JSON.stringify(CONFIG)};
process.stdout.write(JSON.stringify(readEntrypointConfig(${JSON.stringify(env)})));`;
    const raw = execFileSync(process.execPath, [
      '--input-type=module',
      '-e',
      src,
    ]);
    return JSON.parse(raw.toString()) as Record<string, unknown>;
  }

  it('без env — значения по умолчанию', () => {
    expect(read({})).toMatchObject({
      APP_PORT: 3001,
      MIGRATE_CMD: 'npx prisma migrate deploy',
      MAX_FAILS: 3,
      MAX_FAILS_HOUR: 6,
      CRASH_WINDOW_MS: 900000,
      COOLDOWN_MS: 300000,
      MIGRATE_MAX_ATTEMPTS: 3,
    });
  });

  it('env перекрывает; мусор в окне падений — значение по умолчанию', () => {
    const cfg = read({
      APP_PORT: '4000',
      STARTUP_MAX_FAILS: '5',
      STARTUP_CRASH_WINDOW_MS: 'abc',
    });
    expect(cfg).toMatchObject({
      APP_PORT: 4000,
      MAX_FAILS: 5,
      CRASH_WINDOW_MS: 900000,
    });
  });
});
