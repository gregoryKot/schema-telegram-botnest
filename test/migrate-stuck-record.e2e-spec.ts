// Упавшая миграция + откат образа на ЖИВОМ Postgres (аудит 2026-10-11, infra#8).
// Автооткат VPS возвращал образ, но не схему: упавшая миграция нового релиза
// оставляет в _prisma_migrations запись с finished_at IS NULL, и образ
// предыдущего релиза упирается в неё (P3009) — приложение не стартует вовсе.
// Мок этого не проверяет (правило №18): что Prisma не оборачивает миграцию в
// транзакцию, что запись остаётся и что DELETE её снимает — свойства Prisma и
// Postgres. Образ N — prisma/ репозитория, образ N+1 — его копия с битой
// миграцией (класс 2026-07-18: CREATE TABLE без IF NOT EXISTS, 42P07), как в
// проде. Откат гонит НАСТОЯЩИЙ deploy/entrypoint.mjs с дефолтными
// RECOVER_CMD/MIGRATE_CMD (правило №14: тест на шве, не на подставленной
// команде). Гоняется в CI-джобе `migrations`.
import { ChildProcess, spawn, spawnSync } from 'child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { createServer } from 'net';
import { tmpdir } from 'os';
import { join } from 'path';

jest.setTimeout(300_000);

const ROOT = process.cwd();
const PRISMA = join(ROOT, 'node_modules', '.bin', 'prisma');
const BROKEN = '20261011120000_broken_dup_user';
const SLOW = '20261011130000_slow_index';
const DB = `migrate_stuck_${process.pid}`;

const BASE = new URL(
  process.env.DATABASE_URL ?? 'postgresql://postgres:ci@localhost:5432/ci',
);
const urlOf = (db: string) => {
  const u = new URL(BASE.toString());
  u.pathname = `/${db}`;
  return u.toString();
};
const DB_URL = urlOf(DB);

function psql(db: string, args: string[]) {
  return spawnSync('psql', ['-X', '-q', '-t', '-A', urlOf(db), ...args], {
    encoding: 'utf8',
  });
}
function sql(db: string, query: string): string {
  const res = psql(db, ['-v', 'ON_ERROR_STOP=1', '-c', query]);
  if (res.status !== 0) throw new Error(`psql упал: ${res.stderr}`);
  return res.stdout.trim();
}
const stuck = () =>
  sql(
    DB,
    'SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL ORDER BY 1',
  );
const hasTable = (name: string) =>
  sql(DB, `SELECT to_regclass('"${name}"') IS NOT NULL`) === 't';

let imageN1: string; // каталог «образа N+1»: prisma/ + prisma.config.js
const migrationDir = (name: string) =>
  join(imageN1, 'prisma', 'migrations', name);

function migrate(cwd: string, config?: string) {
  return spawnSync(
    PRISMA,
    ['migrate', 'deploy', ...(config ? ['--config', config] : [])],
    { cwd, env: { ...process.env, DATABASE_URL: DB_URL }, encoding: 'utf8' },
  );
}
const migrateN1 = () => migrate(imageN1, join(imageN1, 'prisma.config.js'));
const migrateN = () => migrate(ROOT);
const writeMigration = (name: string, body: string) => {
  mkdirSync(migrationDir(name), { recursive: true });
  writeFileSync(join(migrationDir(name), 'migration.sql'), body);
};

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address() as { port: number };
      srv.close(() => resolve(port));
    });
  });
}

// Настоящий entrypoint образа N с дефолтными RECOVER_CMD и MIGRATE_CMD. Он
// дошёл до приложения, если запустил APP_CMD (файл-маркер) и вышел с кодом 0.
async function runEntrypoint(): Promise<{ code: number | null; out: string }> {
  const marker = join(imageN1, 'app-started');
  const env = {
    ...process.env,
    DATABASE_URL: DB_URL,
    PORT: String(await freePort()),
    APP_PORT: String(await freePort()),
    APP_CMD: `node -e "require('fs').writeFileSync('${marker}','1')"`,
    MIGRATE_MAX_ATTEMPTS: '1',
    MIGRATE_BACKOFF_MS: '0',
  };
  const proc: ChildProcess = spawn('node', ['deploy/entrypoint.mjs'], {
    cwd: ROOT,
    env,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '';
  proc.stdout?.on('data', (d) => (out += d));
  proc.stderr?.on('data', (d) => (out += d));
  const code = await new Promise<number | null>((resolve) => {
    const timer = setTimeout(() => {
      try {
        if (proc.pid) process.kill(-proc.pid, 'SIGKILL');
      } catch {
        proc.kill('SIGKILL');
      }
      resolve(null);
    }, 90_000);
    proc.once('exit', (c) => {
      clearTimeout(timer);
      resolve(c);
    });
  });
  const started = spawnSync('test', ['-e', marker]).status === 0;
  return { code: started ? code : null, out };
}

describe('упавшая миграция и откат образа на реальном Postgres', () => {
  beforeAll(() => {
    sql('postgres', `DROP DATABASE IF EXISTS "${DB}"`);
    sql('postgres', `CREATE DATABASE "${DB}"`);
    imageN1 = mkdtempSync(join(tmpdir(), 'image-n1-'));
    cpSync(join(ROOT, 'prisma'), join(imageN1, 'prisma'), { recursive: true });
    writeFileSync(
      join(imageN1, 'prisma.config.js'),
      `const { defineConfig } = require('${join(ROOT, 'node_modules', 'prisma', 'config')}');
module.exports = defineConfig({ datasource: { url: process.env.DATABASE_URL }, schema: '${join(imageN1, 'prisma', 'schema.prisma')}' });
`,
    );
  });
  afterAll(() => {
    sql('postgres', `DROP DATABASE IF EXISTS "${DB}"`);
    rmSync(imageN1, { recursive: true, force: true });
  });

  it('1. образ N накатывает схему; чистая база не имеет застрявших записей', () => {
    const res = migrateN();

    expect(res.status).toBe(0);
    expect(stuck()).toBe('');
  });

  it('2. образ N+1 с битой миграцией падает, запись застревает, огрызок остаётся в схеме', () => {
    // Два оператора: первый успевает выполниться, второй падает (42P07).
    writeMigration(
      BROKEN,
      'CREATE TABLE "StuckPartial" ("id" integer);\nCREATE TABLE "User" ("id" integer);\n',
    );

    const res = migrateN1();

    expect(res.status).not.toBe(0);
    expect(stuck()).toBe(BROKEN);
    // Prisma не оборачивает миграцию в транзакцию: поэтому снятие записи
    // безопасно только при идемпотентных миграциях (шапка recover-p3009.sql).
    expect(hasTable('StuckPartial')).toBe(true);
  });

  it('3. контроль: без снятия записи образ N не накатывается (P3009), то есть откат образа без отката схемы не работает', () => {
    const res = migrateN();

    expect(res.status).not.toBe(0);
    expect(res.stdout + res.stderr).toContain('P3009');
    expect(stuck()).toBe(BROKEN);
  });

  it('4. recover-p3009.sql через prisma db execute (как в entrypoint) снимает запись по любому имени', () => {
    const res = spawnSync(
      PRISMA,
      ['db', 'execute', '--file', 'prisma/recover-p3009.sql'],
      {
        cwd: ROOT,
        env: { ...process.env, DATABASE_URL: DB_URL },
        encoding: 'utf8',
      },
    );

    expect(res.status).toBe(0);
    expect(stuck()).toBe('');
    expect(hasTable('StuckPartial')).toBe(true); // огрызок остаётся, снимается только запись
  });

  it('5. после снятия образ N накатывается без ошибок', () => {
    const res = migrateN();

    expect(res.status).toBe(0);
    expect(res.stdout).toContain('No pending migrations');
  });

  it('6. настоящий entrypoint образа N поднимает приложение поверх застрявшей записи N+1', async () => {
    expect(migrateN1().status).not.toBe(0); // запись N+1 снова застряла
    expect(stuck()).toBe(BROKEN);

    const { code, out } = await runEntrypoint();

    expect(out).not.toContain('держу страницу техработ');
    expect(code).toBe(0); // APP_CMD запущен, чистый выход
    expect(stuck()).toBe('');
  });

  it('7. повторный запуск recover на здоровой базе ничего не удаляет и не падает', () => {
    const before = sql(DB, 'SELECT count(*) FROM _prisma_migrations');

    const res = psql(DB, [
      '-v',
      'ON_ERROR_STOP=1',
      '-f',
      'prisma/recover-p3009.sql',
    ]);

    expect(res.status).toBe(0);
    expect(res.stdout.trim()).toBe('');
    expect(sql(DB, 'SELECT count(*) FROM _prisma_migrations')).toBe(before);
  });

  it('8. исправленная (идемпотентная) N+1 ложится поверх огрызка', () => {
    writeMigration(
      BROKEN,
      'CREATE TABLE IF NOT EXISTS "StuckPartial" ("id" integer);\nCREATE TABLE IF NOT EXISTS "User" ("id" integer);\n',
    );

    const res = migrateN1();

    expect(res.status).toBe(0);
    expect(stuck()).toBe('');
    expect(
      sql(
        DB,
        `SELECT count(*) FROM _prisma_migrations WHERE migration_name = '${BROKEN}' AND finished_at IS NOT NULL`,
      ),
    ).toBe('1');
  });

  it('9. миграция, которая выполняется прямо сейчас, не принимается за застрявшую: запись жива, миграция доходит до конца', async () => {
    writeMigration(SLOW, 'SELECT pg_sleep(8);\n');
    const slow: ChildProcess = spawn(
      PRISMA,
      ['migrate', 'deploy', '--config', join(imageN1, 'prisma.config.js')],
      {
        cwd: imageN1,
        env: { ...process.env, DATABASE_URL: DB_URL },
        stdio: 'ignore',
      },
    );
    const done = new Promise<number | null>((resolve) =>
      slow.once('exit', resolve),
    );
    try {
      const until = Date.now() + 60_000;
      while (stuck() !== SLOW && Date.now() < until) {
        await new Promise((r) => setTimeout(r, 200));
      }
      expect(stuck()).toBe(SLOW); // запись создана, миграция идёт

      const res = psql(DB, [
        '-v',
        'ON_ERROR_STOP=1',
        '-f',
        'prisma/recover-p3009.sql',
      ]);

      expect(res.status).toBe(0);
      expect(res.stdout.trim()).toBe(''); // advisory-lock Prisma занят: ничего не удалено
      expect(stuck()).toBe(SLOW);
    } finally {
      expect(await done).toBe(0);
    }
    expect(stuck()).toBe('');
    expect(
      sql(
        DB,
        `SELECT count(*) FROM _prisma_migrations WHERE migration_name = '${SLOW}' AND finished_at IS NOT NULL`,
      ),
    ).toBe('1');
  });

  it('10. psql печатает ровно имена снятых записей (то, что видит владелец в логе операции)', () => {
    sql(
      DB,
      `INSERT INTO _prisma_migrations (id, checksum, migration_name, started_at, applied_steps_count, logs) VALUES ('stuck-1', 'x', '20261099000001_stuck_a', now(), 0, 'секрет: значение из таблицы'), ('stuck-2', 'x', '20261099000002_stuck_b', now(), 0, NULL)`,
    );

    const res = psql(DB, [
      '-v',
      'ON_ERROR_STOP=1',
      '-f',
      'prisma/recover-p3009.sql',
    ]);

    expect(res.status).toBe(0);
    expect(res.stdout.trim().split('\n').sort()).toEqual([
      '20261099000001_stuck_a',
      '20261099000002_stuck_b',
    ]);
    expect(res.stdout).not.toContain('секрет');
    expect(stuck()).toBe('');
  });
});
