// Планировщик бэкапов в B2 (deploy/backup-scheduler.cjs, аудит D-2). До него
// scripts/backup-to-b2.sh не вызывал никто. Модуль — CommonJS именно ради
// этого спека: jest не грузит ESM, а все внешнее (spawn, время, psql, лог)
// подменяется, поэтому тик идёт без процессов и без часов.
import { EventEmitter } from 'events';
import { readFileSync } from 'fs';
import { join } from 'path';
import { BACKUP_REQUIRED_ENV_VARS } from './backup-config';

interface Ctx {
  env: Record<string, string>;
  now: () => Date;
  spawn: unknown;
  psql: (sql: string, vars: Record<string, string>) => Promise<PsqlResult>;
  log: { info: (m: string) => void; error: (m: string) => void };
  state: Record<string, unknown>;
  instanceId: string;
  script: string;
}
interface PsqlResult {
  code: number;
  stdout: string;
  stderr: string;
  error?: { code?: string; message?: string };
}
interface Scheduler {
  REQUIRED_ENV: string[];
  LEASE_NAME: string;
  LEASE_WINDOW_MS: number;
  runTick(ctx: Ctx): Promise<string>;
  makePsql(o: { spawn: unknown; env: Record<string, string> }): Ctx['psql'];
  startBackupScheduler(o?: Record<string, unknown>): { stop(): void } | null;
}
const sched = jest.requireActual<Scheduler>(
  join(process.cwd(), 'deploy', 'backup-scheduler.cjs'),
);

const ENV = {
  B2_KEY_ID: 'keyid',
  B2_APP_KEY: 'appkey-SECRET',
  B2_BUCKET: 'bkt',
  BACKUP_ENCRYPTION_KEY: 'enc-key-SECRET-0123456789abcdefghij',
  DATABASE_URL: 'postgresql://u:db-PASSWORD@db.example:5432/app?schema=public',
};
const at = (iso: string) => () => new Date(iso);

interface FakeRun {
  stdout?: string;
  stderr?: string;
  code?: number;
}

/** spawn, который «исполняет» команды по очереди из сценария. */
function fakeSpawn(script: FakeRun[]) {
  const calls: Array<{ cmd: string; args: string[]; opts: any }> = [];
  const spawn = (cmd: string, args: string[], opts: unknown) => {
    calls.push({ cmd, args, opts });
    const run = script.shift() ?? { code: 0 };
    const child = Object.assign(new EventEmitter(), {
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
      stdin: { end: jest.fn() },
      kill: jest.fn(),
    });
    setImmediate(() => {
      if (run.stdout) child.stdout.emit('data', run.stdout);
      if (run.stderr) child.stderr.emit('data', run.stderr);
      child.emit('close', run.code ?? 0, null);
    });
    return child;
  };
  return { spawn, calls };
}

const OK_BACKUP = {
  stdout: '[backup] dump...\n[backup] ok schemehappens-2026-10-04.sql.gz.enc\n',
};

function setup(opts: {
  psqlResults: PsqlResult[];
  backup?: FakeRun[];
  now?: string;
}) {
  const logs: string[] = [];
  const errors: string[] = [];
  const queue = [...opts.psqlResults];
  const psql = jest.fn(
    async (_sql: string, _vars: Record<string, string>) =>
      queue.shift() ?? { code: 0, stdout: '', stderr: '' },
  );
  const fs = fakeSpawn(opts.backup ?? [OK_BACKUP]);
  const ctx: Ctx = {
    env: ENV,
    now: at(opts.now ?? '2026-10-04T05:00:00.000Z'),
    spawn: fs.spawn,
    psql,
    log: { info: (m) => logs.push(m), error: (m) => errors.push(m) },
    state: {
      doneDay: null,
      failDay: null,
      fails: 0,
      running: false,
      warnedNoPsql: false,
      child: null,
    },
    instanceId: 'pod-A',
    script: '/app/scripts/backup-to-b2.sh',
  };
  return { ctx, psql, logs, errors, spawnCalls: fs.calls };
}

const CLAIMED: PsqlResult = { code: 0, stdout: 'backup-b2\n', stderr: '' };
const DENIED: PsqlResult = { code: 0, stdout: '', stderr: '' };

describe('startBackupScheduler: конфигурация', () => {
  it('ничего не настроено — одна строка «выключены: нет …», планировщика нет', () => {
    const info = jest.fn();
    const res = sched.startBackupScheduler({
      env: {},
      log: { info, error: jest.fn() },
    });
    expect(res).toBeNull();
    expect(info).toHaveBeenCalledTimes(1);
    expect(info.mock.calls[0][0]).toMatch(
      /бэкапы в B2 выключены: нет B2_KEY_ID/,
    );
  });

  it('не хватает одной переменной — выключены и называет именно её', () => {
    const info = jest.fn();
    const { B2_BUCKET: _omit, ...rest } = ENV;
    expect(
      sched.startBackupScheduler({
        env: rest,
        log: { info, error: jest.fn() },
      }),
    ).toBeNull();
    expect(info.mock.calls[0][0]).toContain('нет B2_BUCKET');
    expect(info.mock.calls[0][0]).not.toContain('B2_KEY_ID');
  });

  it('пробел вместо значения — как «не задано»', () => {
    const info = jest.fn();
    sched.startBackupScheduler({
      env: { ...ENV, B2_APP_KEY: '   ' },
      log: { info, error: jest.fn() },
    });
    expect(info.mock.calls[0][0]).toContain('B2_APP_KEY');
  });

  it('всё задано — стартует, ставит таймеры, stop() их снимает', () => {
    jest.useFakeTimers();
    try {
      const info = jest.fn();
      const spawn = jest.fn();
      const res = sched.startBackupScheduler({
        env: ENV,
        spawn,
        psql: jest.fn(),
        log: { info, error: jest.fn() },
      });
      expect(res).not.toBeNull();
      expect(info.mock.calls[0][0]).toContain('включены');
      expect(info.mock.calls[0][0]).not.toContain('SECRET');
      res!.stop();
      jest.advanceTimersByTime(2 * 3_600_000);
      expect(spawn).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  // Правило №4: два списка, обязанные совпадать, фиксируются тестом.
  it('REQUIRED_ENV планировщика = backup-config.ts + DATABASE_URL', () => {
    expect([...sched.REQUIRED_ENV].sort()).toEqual(
      [...BACKUP_REQUIRED_ENV_VARS, 'DATABASE_URL'].sort(),
    );
  });
});

describe('runTick: когда запускаться', () => {
  it('до 03:00 UTC — ничего не делает, даже в БД не ходит', async () => {
    const t = setup({ psqlResults: [], now: '2026-10-04T02:59:59.000Z' });
    expect(await sched.runTick(t.ctx)).toBe('early');
    expect(t.psql).not.toHaveBeenCalled();
    expect(t.spawnCalls).toHaveLength(0);
  });

  it('ровно 03:00 UTC — запускается', async () => {
    const t = setup({
      psqlResults: [CLAIMED],
      now: '2026-10-04T03:00:00.000Z',
    });
    expect(await sched.runTick(t.ctx)).toBe('ok');
  });

  it('аренда забрана, бэкап ok — запускает bash scripts/backup-to-b2.sh, логирует «ok <файл>»', async () => {
    const t = setup({ psqlResults: [CLAIMED] });
    expect(await sched.runTick(t.ctx)).toBe('ok');
    expect(t.spawnCalls).toHaveLength(1);
    expect(t.spawnCalls[0].cmd).toBe('bash');
    expect(t.spawnCalls[0].args).toEqual(['/app/scripts/backup-to-b2.sh']);
    // Ключи едут в окружении скрипта, а не в аргументах команды.
    expect(t.spawnCalls[0].opts.env.BACKUP_ENCRYPTION_KEY).toBe(
      ENV.BACKUP_ENCRYPTION_KEY,
    );
    expect(t.logs).toContain('[backup] ok schemehappens-2026-10-04.sql.gz.enc');
    expect(t.errors).toEqual([]);
  });

  it('после успеха второй тик того же дня ничего не делает', async () => {
    const t = setup({ psqlResults: [CLAIMED] });
    await sched.runTick(t.ctx);
    t.psql.mockClear();
    expect(await sched.runTick(t.ctx)).toBe('done');
    expect(t.psql).not.toHaveBeenCalled();
    expect(t.spawnCalls).toHaveLength(1);
  });

  it('на следующие сутки — снова запускается', async () => {
    const t = setup({
      psqlResults: [CLAIMED, CLAIMED],
      backup: [OK_BACKUP, OK_BACKUP],
    });
    await sched.runTick(t.ctx);
    t.ctx.now = at('2026-10-05T03:30:00.000Z');
    expect(await sched.runTick(t.ctx)).toBe('ok');
    expect(t.spawnCalls).toHaveLength(2);
  });

  it('аренду забрал другой инстанс — бэкап не запускается, сегодня больше не спрашиваем', async () => {
    const t = setup({ psqlResults: [DENIED] });
    expect(await sched.runTick(t.ctx)).toBe('not-leader');
    expect(t.spawnCalls).toHaveLength(0);
    t.psql.mockClear();
    expect(await sched.runTick(t.ctx)).toBe('done');
    expect(t.psql).not.toHaveBeenCalled();
  });

  it('тик во время идущего прогона — busy, без второго запуска', async () => {
    const t = setup({ psqlResults: [CLAIMED] });
    t.ctx.state.running = true;
    expect(await sched.runTick(t.ctx)).toBe('busy');
    expect(t.psql).not.toHaveBeenCalled();
  });
});

describe('runTick: аренда (та же семантика, что CronLeaderService.claimRun)', () => {
  it('атомарный INSERT … ON CONFLICT DO UPDATE … WHERE "runAt" <= окно, значения — переменными psql', async () => {
    const t = setup({ psqlResults: [CLAIMED] });
    await sched.runTick(t.ctx);
    const [sql, vars] = t.psql.mock.calls[0];
    expect(sql).toContain('INSERT INTO "CronLease"');
    expect(sql).toContain('ON CONFLICT ("name") DO UPDATE');
    expect(sql).toContain('WHERE "CronLease"."runAt" <= :\'not_after\'');
    expect(sql).toContain('RETURNING "name"');
    // Ни одно значение не склеено в текст SQL — только :'переменные' psql.
    expect(sql).not.toContain('pod-A');
    expect(sql).not.toContain('2026');
    expect(vars).toEqual({
      lease: 'backup-b2',
      inst: 'pod-A',
      now: '2026-10-04 05:00:00.000',
      not_after: '2026-10-03 09:00:00.000', // окно 20 ч < периода 24 ч
    });
    expect(sched.LEASE_WINDOW_MS).toBeLessThan(24 * 3_600_000);
  });

  it('psql не найден в образе — «no-psql», ошибка в лог один раз, бэкап не запускается', async () => {
    const enoent = {
      code: -1,
      stdout: '',
      stderr: '',
      error: { code: 'ENOENT', message: 'spawn psql ENOENT' },
    };
    const t = setup({ psqlResults: [enoent, enoent] });
    expect(await sched.runTick(t.ctx)).toBe('no-psql');
    expect(await sched.runTick(t.ctx)).toBe('no-psql');
    expect(t.errors.filter((e) => e.includes('psql не найден'))).toHaveLength(
      1,
    );
    expect(t.spawnCalls).toHaveLength(0);
  });

  it('БД недоступна — «db-error», FAILED в логе, бэкап не запускается', async () => {
    const t = setup({
      psqlResults: [
        { code: 2, stdout: '', stderr: 'psql: error: connection refused\n' },
      ],
    });
    expect(await sched.runTick(t.ctx)).toBe('db-error');
    expect(t.errors[0]).toContain('[backup] FAILED');
    expect(t.errors[0]).toContain('connection refused');
    expect(t.spawnCalls).toHaveLength(0);
  });
});

describe('runTick: сбой бэкапа', () => {
  const FAIL = {
    code: 1,
    stderr:
      'pg_dump: error: connection failed\n[backup] FAILED команда на строке 99 завершилась с кодом 1\n',
  };

  it('FAILED с причиной в логе; своя аренда освобождается — следующий час повторит', async () => {
    const t = setup({
      psqlResults: [CLAIMED, DENIED /* release */, CLAIMED],
      backup: [FAIL, OK_BACKUP],
    });
    expect(await sched.runTick(t.ctx)).toBe('failed');
    expect(t.errors[0]).toContain('[backup] FAILED');
    expect(t.errors[0]).toContain('pg_dump: error: connection failed');
    expect(t.errors[0]).toContain('попытка 1/3');
    const [releaseSql, releaseVars] = t.psql.mock.calls[1];
    expect(releaseSql).toContain('UPDATE "CronLease"');
    expect(releaseSql).toContain('"instanceId" = :\'inst\'');
    expect(releaseVars).toEqual({ lease: 'backup-b2', inst: 'pod-A' });

    t.ctx.now = at('2026-10-04T06:00:00.000Z');
    expect(await sched.runTick(t.ctx)).toBe('ok');
  });

  it('код 0, но строки «[backup] ok» нет — тоже сбой (скрипт «молча» ничего не сделал)', async () => {
    const t = setup({
      psqlResults: [CLAIMED, DENIED],
      backup: [{ code: 0, stdout: 'что-то постороннее\n' }],
    });
    expect(await sched.runTick(t.ctx)).toBe('failed');
  });

  it('три сбоя за день — «gave-up» (не долбим БД каждый час), на следующие сутки счётчик свежий', async () => {
    const t = setup({
      psqlResults: [CLAIMED, DENIED, CLAIMED, DENIED, CLAIMED, DENIED, CLAIMED],
      backup: [FAIL, FAIL, FAIL, OK_BACKUP],
    });
    for (let i = 0; i < 3; i += 1) {
      expect(await sched.runTick(t.ctx)).toBe('failed');
    }
    expect(t.errors[2]).toContain('попытка 3/3');
    expect(await sched.runTick(t.ctx)).toBe('gave-up');
    expect(t.spawnCalls).toHaveLength(3);

    t.ctx.now = at('2026-10-05T04:00:00.000Z');
    expect(await sched.runTick(t.ctx)).toBe('ok');
  });

  it('ключи и пароль БД не попадают в лог ни в успехе, ни в сбое', async () => {
    const t = setup({
      psqlResults: [CLAIMED, DENIED],
      backup: [FAIL],
    });
    await sched.runTick(t.ctx);
    const all = [...t.logs, ...t.errors].join('\n');
    for (const secret of ['appkey-SECRET', 'enc-key-SECRET', 'db-PASSWORD']) {
      expect(all).not.toContain(secret);
    }
  });
});

describe('makePsql: соединение с БД', () => {
  it('пароль БД едет в окружении psql (PGPASSWORD), а не в аргументах; SQL — через stdin', async () => {
    const fs = fakeSpawn([{ code: 0, stdout: 'backup-b2\n' }]);
    const psql = sched.makePsql({ spawn: fs.spawn, env: ENV });
    const res = await psql("SELECT :'x';", { x: '1' });
    expect(res.stdout).toBe('backup-b2\n');
    const call = fs.calls[0];
    expect(call.cmd).toBe('psql');
    expect(call.args.join(' ')).not.toContain('db-PASSWORD');
    expect(call.args).toEqual(
      expect.arrayContaining(['ON_ERROR_STOP=1', 'x=1', '-f', '-']),
    );
    expect(call.opts.env).toMatchObject({
      PGHOST: 'db.example',
      PGPORT: '5432',
      PGUSER: 'u',
      PGPASSWORD: 'db-PASSWORD',
      PGDATABASE: 'app',
    });
  });

  it('DATABASE_URL, который не разобрать, — ошибка без запуска psql', async () => {
    const fs = fakeSpawn([]);
    const psql = sched.makePsql({
      spawn: fs.spawn,
      env: { ...ENV, DATABASE_URL: 'не url' },
    });
    const res = await psql('SELECT 1', {});
    expect(res.code).toBe(-1);
    expect(res.error?.message).toMatch(/DATABASE_URL/);
    expect(fs.calls).toHaveLength(0);
  });
});

describe('deploy/entrypoint.mjs подключает планировщик', () => {
  const entry = readFileSync(
    join(process.cwd(), 'deploy', 'entrypoint.mjs'),
    'utf8',
  );
  it('импортирует backup-scheduler.cjs и стартует его ПОСЛЕ успешных миграций', () => {
    expect(entry).toContain("from './backup-scheduler.cjs'");
    const migrated = entry.indexOf('if (!migrateOk)');
    const started = entry.indexOf('startBackupScheduler()');
    expect(migrated).toBeGreaterThan(0);
    expect(started).toBeGreaterThan(migrated);
  });
  it('останавливает планировщик при завершении', () => {
    expect(entry).toContain('backup?.stop()');
  });
});
