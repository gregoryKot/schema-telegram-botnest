// Остановка идущего бэкапа (deploy/backup-lease-release.cjs). Регресс
// (docs/open/backend.md): stop() гасил скрипт, а аренда 'db-backup'
// отпускалась асинхронно в ветке failed — и проигрывала гонку process.exit
// в entrypoint: бэкап, оборванный деплоем, шёл снова только через 20 ч.
// Живой SQL релиза (только своя аренда) — test/backup-lease.e2e-spec.ts.
import { EventEmitter } from 'events';
import { join } from 'path';

interface Scheduler {
  startBackupScheduler(o?: Record<string, unknown>): {
    tick(): Promise<void>;
    stop(): void;
  } | null;
}
const sched = jest.requireActual<Scheduler>(
  join(process.cwd(), 'deploy', 'backup-scheduler.cjs'),
);

const ENV = {
  BACKUP_S3_ENDPOINT: 'https://acc.r2.cloudflarestorage.com',
  BACKUP_S3_BUCKET: 'bkt',
  BACKUP_S3_ACCESS_KEY_ID: 'keyid',
  BACKUP_S3_SECRET_ACCESS_KEY: 'appkey-SECRET',
  BACKUP_ENCRYPTION_KEY: 'enc-key-SECRET-0123456789abcdefghij',
  DATABASE_URL: 'postgresql://u:pw@db.example:5432/app',
  HOSTNAME: 'pod-A',
};

/** Скрипт бэкапа, который не заканчивается сам (идёт, пока его не погасят). */
function hangingSpawn() {
  const child = Object.assign(new EventEmitter(), {
    stdout: new EventEmitter(),
    stderr: new EventEmitter(),
    stdin: { end: jest.fn() },
    kill: jest.fn(() => {
      setImmediate(() => child.emit('close', null, 'SIGTERM'));
      return true;
    }),
  });
  return { spawn: jest.fn(() => child), child };
}

function start(spawnSync: jest.Mock) {
  const { spawn, child } = hangingSpawn();
  const info = jest.fn();
  const error = jest.fn();
  const psql = jest.fn(async (sql: string) =>
    /INSERT INTO "CronLease"/.test(sql)
      ? { code: 0, stdout: 'db-backup\n', stderr: '' }
      : { code: 0, stdout: '', stderr: '' },
  );
  const res = sched.startBackupScheduler({
    env: ENV,
    spawn,
    spawnSync,
    psql,
    now: () => new Date('2026-10-04T05:00:00.000Z'),
    log: { info, error },
    firstTickMs: 3_600_000,
  });
  return { res: res!, child, info, error };
}

const flush = () => new Promise((r) => setImmediate(r));

afterEach(() => jest.clearAllTimers());

describe('backup-lease-release: stop() во время прогона', () => {
  it('гасит скрипт и синхронно отпускает свою аренду', async () => {
    const spawnSync = jest.fn(() => ({ status: 0, stdout: '', stderr: '' }));
    const { res, child, info } = start(spawnSync);
    void res.tick();
    await flush(); // аренда взята, скрипт запущен
    res.stop();
    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
    expect(spawnSync).toHaveBeenCalledTimes(1);
    const [cmd, args, opts] = spawnSync.mock.calls[0] as unknown as [
      string,
      string[],
      { input: string; timeout: number; env: Record<string, string> },
    ];
    expect(cmd).toBe('psql');
    expect(args).toEqual(
      expect.arrayContaining(['lease=db-backup', 'inst=pod-A']),
    );
    expect(opts.input).toMatch(/UPDATE "CronLease" SET "runAt" = 'epoch'/);
    expect(opts.input).toMatch(/"instanceId" = :'inst'/); // только своя
    expect(opts.env.PGHOST).toBe('db.example');
    expect(opts.timeout).toBeLessThanOrEqual(5_000);
    expect(info).toHaveBeenCalledWith(
      expect.stringContaining('аренда отпущена'),
    );
  });

  it('релиз не удался — громкая строка в лог, stop() не бросает', async () => {
    const spawnSync = jest.fn(() => ({ status: 2, stderr: 'conn refused' }));
    const { res, error } = start(spawnSync);
    void res.tick();
    await flush();
    expect(() => res.stop()).not.toThrow();
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('аренда при остановке не отпущена: conn refused'),
    );
  });

  // Контроль: без идущего прогона аренды нет — и отпускать нечего.
  it('прогон не идёт — psql при остановке не зовётся', () => {
    const spawnSync = jest.fn();
    const { res } = start(spawnSync);
    res.stop();
    expect(spawnSync.mock.calls).toEqual([]);
  });
});

// Сам модуль, напрямую (check-unwatched-code: файл вне src/ читается тестом).
interface Release {
  stopRun(ctx: Record<string, unknown>, sql: string, lease: string): boolean;
  STOP_RELEASE_TIMEOUT_MS: number;
}
const release = jest.requireActual<Release>(
  join(process.cwd(), 'deploy', 'backup-lease-release.cjs'),
);

describe('deploy/backup-lease-release.cjs: stopRun', () => {
  const ctx = (over: Record<string, unknown>) => ({
    state: { child: { kill: jest.fn() } },
    env: ENV,
    log: { info: jest.fn(), error: jest.fn() },
    instanceId: 'pod-B',
    ...over,
  });

  it('битый DATABASE_URL — не бросает, false и строка FAILED', () => {
    const spawnSync = jest.fn();
    const c = ctx({ env: { ...ENV, DATABASE_URL: '::not a url' }, spawnSync });
    expect(release.stopRun(c, 'SQL', 'db-backup')).toBe(false);
    expect(spawnSync.mock.calls).toEqual([]);
    expect((c.log as { error: jest.Mock }).error.mock.calls[0][0]).toMatch(
      /^\[backup\] FAILED аренда при остановке не отпущена: /,
    );
  });

  it('psql ответил 0 — true; таймаут релиза короче страховки выхода', () => {
    const spawnSync = jest.fn(() => ({ status: 0 }));
    expect(release.stopRun(ctx({ spawnSync }), 'SQL', 'db-backup')).toBe(true);
    expect(release.STOP_RELEASE_TIMEOUT_MS).toBe(5_000);
  });
});
