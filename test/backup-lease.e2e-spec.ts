// Аренда прогона бэкапа (deploy/backup-scheduler.cjs) на РЕАЛЬНОМ Postgres.
// Планировщик берёт аренду строкой CronLease 'backup-b2' через psql, тем же
// атомарным INSERT … ON CONFLICT DO UPDATE … WHERE "runAt" <= окно, что
// CronLeaderService.claimRun (правило №17). Атомарность — свойство Postgres,
// а не нашего кода: фейковый psql ответит что угодно (правило №18). Здесь
// настоящий psql против настоящей базы; подменён только запуск самого
// скрипта бэкапа (в нём pg_dump и B2 — их проверяют другие спеки).
// Гоняется в CI-джобе `migrations` (Postgres 16 + psql, миграции применены).
import { spawn as realSpawn } from 'child_process';
import { EventEmitter } from 'events';
import { join } from 'path';
import { PrismaService } from '../src/prisma/prisma.service';

interface Scheduler {
  LEASE_NAME: string;
  makePsql(o: { spawn: unknown; env: NodeJS.ProcessEnv }): unknown;
  runTick(ctx: Record<string, unknown>): Promise<string>;
}
const sched = jest.requireActual<Scheduler>(
  join(process.cwd(), 'deploy', 'backup-scheduler.cjs'),
);

const NAME = 'backup-b2';

/** spawn: psql — настоящий, bash (скрипт бэкапа) — подделка с заданным исходом. */
function mixedSpawn(
  backup: { code: number; stdout: string; stderr?: string },
  ran: string[],
) {
  return (cmd: string, args: string[], opts: Record<string, unknown>) => {
    if (cmd === 'psql') return realSpawn(cmd, args, opts as never);
    ran.push(cmd);
    const child = Object.assign(new EventEmitter(), {
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
      stdin: { end: () => undefined },
      kill: () => true,
    });
    setImmediate(() => {
      child.stdout.emit('data', backup.stdout);
      if (backup.stderr) child.stderr.emit('data', backup.stderr);
      child.emit('close', backup.code, null);
    });
    return child;
  };
}

describe('аренда бэкапа на реальном Postgres', () => {
  let prisma: PrismaService;
  const env = { ...process.env };
  const OK = {
    code: 0,
    stdout: '[backup] ok schemehappens-2026-10-04.sql.gz.enc\n',
  };

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
  });
  beforeEach(async () => {
    await prisma.cronLease.deleteMany({ where: { name: NAME } });
  });
  afterAll(async () => {
    await prisma.cronLease.deleteMany({ where: { name: NAME } });
    await prisma.$disconnect();
  });

  function instance(id: string, at: string, backup = OK, ran: string[] = []) {
    const spawn = mixedSpawn(backup, ran);
    return {
      ran,
      ctx: {
        env,
        spawn,
        psql: sched.makePsql({ spawn, env }),
        now: () => new Date(at),
        log: { info: () => undefined, error: () => undefined },
        state: {
          doneDay: null,
          failDay: null,
          fails: 0,
          running: false,
          warnedNoPsql: false,
          child: null,
        },
        instanceId: id,
        script: '/nonexistent/backup-to-b2.sh',
      },
    };
  }

  it('первый прогон забирается: бэкап запущен, строка аренды с временем и инстансом', async () => {
    const a = instance('pod-A', '2026-10-04T05:00:00.000Z');
    expect(await sched.runTick(a.ctx)).toBe('ok');
    expect(a.ran).toEqual(['bash']);
    const row = await prisma.cronLease.findUnique({ where: { name: NAME } });
    expect(row?.runAt.toISOString()).toBe('2026-10-04T05:00:00.000Z');
    expect(row?.instanceId).toBe('pod-A');
  });

  it('второй инстанс в окне 20 ч отказан и НЕ сдвигает аренду', async () => {
    await sched.runTick(instance('pod-A', '2026-10-04T05:00:00.000Z').ctx);
    const b = instance('pod-B', '2026-10-04T06:00:00.000Z');
    expect(await sched.runTick(b.ctx)).toBe('not-leader');
    expect(b.ran).toEqual([]);
    const row = await prisma.cronLease.findUnique({ where: { name: NAME } });
    expect(row?.instanceId).toBe('pod-A');
    expect(row?.runAt.toISOString()).toBe('2026-10-04T05:00:00.000Z');
  });

  it('два инстанса одновременно: бэкап запускает ровно один', async () => {
    const a = instance('pod-A', '2026-10-04T05:00:00.000Z');
    const b = instance('pod-B', '2026-10-04T05:00:00.000Z');
    const results = await Promise.all([
      sched.runTick(a.ctx),
      sched.runTick(b.ctx),
    ]);
    expect(results.sort()).toEqual(['not-leader', 'ok']);
    expect(a.ran.length + b.ran.length).toBe(1);
  });

  it('через 20+ часов аренда снова берётся (завтрашний прогон наступает)', async () => {
    await sched.runTick(instance('pod-A', '2026-10-04T05:00:00.000Z').ctx);
    const next = instance('pod-B', '2026-10-05T03:30:00.000Z');
    expect(await sched.runTick(next.ctx)).toBe('ok');
    expect(next.ran).toEqual(['bash']);
  });

  it('сбой бэкапа освобождает СВОЮ аренду — другой инстанс может повторить в тот же день', async () => {
    const failing = instance('pod-A', '2026-10-04T05:00:00.000Z', {
      code: 1,
      stdout: '',
      stderr: '[backup] FAILED B2: авторизация не удалась\n',
    });
    expect(await sched.runTick(failing.ctx)).toBe('failed');
    const retry = instance('pod-B', '2026-10-04T06:00:00.000Z');
    expect(await sched.runTick(retry.ctx)).toBe('ok');
    const row = await prisma.cronLease.findUnique({ where: { name: NAME } });
    expect(row?.instanceId).toBe('pod-B');
  });

  it('освобождение не затирает ЧУЖУЮ аренду (UPDATE только по своему instanceId)', async () => {
    // pod-B успешно держит аренду; «упавший» pod-A с тем же именем не должен её сбросить.
    await sched.runTick(instance('pod-B', '2026-10-04T05:00:00.000Z').ctx);
    const psql = sched.makePsql({
      spawn: mixedSpawn(OK, []),
      env,
    }) as (
      sql: string,
      vars: Record<string, string>,
    ) => Promise<{ code: number }>;
    const res = await psql(
      `UPDATE "CronLease" SET "runAt" = 'epoch'::timestamp WHERE "name" = :'lease' AND "instanceId" = :'inst';`,
      { lease: NAME, inst: 'pod-A' },
    );
    expect(res.code).toBe(0);
    const row = await prisma.cronLease.findUnique({ where: { name: NAME } });
    expect(row?.instanceId).toBe('pod-B');
    expect(row?.runAt.toISOString()).toBe('2026-10-04T05:00:00.000Z');
  });
});
