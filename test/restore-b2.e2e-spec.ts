// Сквозная связка плана Б (docs/MIGRATION_VPS.md): настоящий backup-to-b2.sh
// снимает дамп живой базы и грузит его в (поддельный) B2 → fetch-latest-b2.sh
// скачивает самый свежий файл → restore-backup.sh заливает его в ПУСТУЮ базу
// настоящим psql → числа сходятся с источником. Мок не заменит ни pg_dump, ни
// psql, ни формат файла между тремя скриптами (правило №18, №23: «тесты стояли
// по обе стороны шва, но не на шве»); юнит-спек fetch-latest-b2.spec.ts
// проверяет только скачивание. Источник — настоящая схема приложения
// (migrate deploy). Гоняется в CI-джобе `migrations` (Postgres 16 + клиент).
import { spawn, spawnSync } from 'child_process';
import { existsSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  FAKE_B2_APP_KEY,
  FAKE_B2_BUCKET,
  FAKE_B2_KEY_ID,
  FakeB2,
} from '../src/test-support/fake-b2';

const SCRIPTS = join(process.cwd(), 'scripts');
const { pgEnvFromUrl } = jest.requireActual<{
  pgEnvFromUrl(url: string): Record<string, string>;
}>(join(process.cwd(), 'deploy', 'pg-url-env.cjs'));

jest.setTimeout(240_000);

const BASE = new URL(
  process.env.DATABASE_URL ?? 'postgresql://postgres:ci@localhost:5432/ci',
);
const SUFFIX = `${process.pid}`;
const DB = { src: `restoreb2_src_${SUFFIX}`, dst: `restoreb2_dst_${SUFFIX}` };
const urlOf = (db: string) => {
  const u = new URL(BASE.toString());
  u.pathname = `/${db}`;
  u.search = '?sslmode=disable';
  return u.toString();
};
const BACKUP_KEY = 'restore-b2-spec-key-' + 'k'.repeat(24);
const MARKER = 'план-б-маркер-Ёж';

function psql(db: string, sql: string): string {
  const res = spawnSync(
    'psql',
    ['-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-c', sql],
    { env: { ...process.env, ...pgEnvFromUrl(urlOf(db)) }, encoding: 'utf8' },
  );
  if (res.status !== 0) throw new Error(`psql(${db}) упал: ${res.stderr}`);
  return res.stdout.trim();
}

// Скрипты ходят в поддельный B2 внутри этого же процесса — spawnSync заблокировал бы сервер.
function bash(
  script: string,
  args: string[],
  env: Record<string, string>,
): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    const child = spawn('bash', [join(SCRIPTS, script), ...args], {
      env: { ...process.env, ...env },
    });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('close', (code) => resolve({ code: code ?? -1, out }));
  });
}

describe('план Б: backup-to-b2.sh → B2 → fetch-latest-b2.sh → restore-backup.sh на реальном Postgres', () => {
  let fake: FakeB2;
  let dir: string;
  const b2Env = () => ({
    B2_KEY_ID: FAKE_B2_KEY_ID,
    B2_APP_KEY: FAKE_B2_APP_KEY,
    B2_BUCKET: FAKE_B2_BUCKET,
    B2_AUTH_URL: fake.authUrl,
  });

  beforeAll(async () => {
    for (const db of Object.values(DB))
      psql('postgres', `DROP DATABASE IF EXISTS "${db}"`);
    for (const db of Object.values(DB))
      psql('postgres', `CREATE DATABASE "${db}"`);
    const migrate = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
      env: { ...process.env, DATABASE_URL: urlOf(DB.src) },
      encoding: 'utf8',
    });
    if (migrate.status !== 0)
      throw new Error(`migrate deploy упал: ${migrate.stderr}`);
    psql(DB.src, `INSERT INTO "User" (id) VALUES (201), (202), (203), (204)`);
    psql(
      DB.src,
      `INSERT INTO "HealthyAdultPost" (text, source) VALUES ('${MARKER}', 'restore-b2-spec')`,
    );
    fake = await new FakeB2().start();
    dir = mkdtempSync(join(tmpdir(), 'restore-b2-'));
  });

  afterAll(async () => {
    await fake.stop();
    rmSync(dir, { recursive: true, force: true });
    for (const db of Object.values(DB))
      psql('postgres', `DROP DATABASE IF EXISTS "${db}"`);
  });

  it('ночной бэкап в бакете → скачан самый свежий → залит в пустую базу → числа и данные сошлись', async () => {
    // Старые копии в бакете: выбрать обязаны сегодняшнюю, настоящую.
    fake.add('schemehappens-2020-01-01.sql.gz.enc', 'старый мусор');
    fake.add('schemehappens-2020-01-01.sql.gz.enc.sha256', 'x  y');

    const backup = await bash('backup-to-b2.sh', [], {
      ...b2Env(),
      DATABASE_URL: urlOf(DB.src),
      BACKUP_ENCRYPTION_KEY: BACKUP_KEY,
      ENCRYPTION_KEY: '',
    });
    expect(backup.code).toBe(0);

    const fetched = await bash(
      'fetch-latest-b2.sh',
      [join(dir, 'dl')],
      b2Env(),
    );
    expect(fetched.code).toBe(0);
    const today = new Date().toISOString().slice(0, 10);
    expect(fetched.out).toMatch(
      new RegExp(
        `\\[fetch-b2\\] ok schemehappens-${today}\\.sql\\.gz\\.enc размер \\d+ байт, дата ${today}`,
      ),
    );
    expect(fetched.out).not.toContain(FAKE_B2_APP_KEY);

    // База-приёмник пуста до заливки (как op=restore-b2 проверяет в ops.sh).
    expect(
      psql(
        DB.dst,
        "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'",
      ),
    ).toBe('0');

    const file = join(dir, 'dl', `schemehappens-${today}.sql.gz.enc`);
    expect(existsSync(`${file}.sha256`)).toBe(true);
    const restored = await bash('restore-backup.sh', [file, urlOf(DB.dst)], {
      BACKUP_ENCRYPTION_KEY: BACKUP_KEY,
    });
    expect(restored.code).toBe(0);
    expect(restored.out).toContain('контрольная сумма сошлась');

    const count = (db: string, table: string) =>
      psql(db, `SELECT count(*) FROM ${table}`);
    expect(count(DB.dst, '_prisma_migrations')).toBe(
      count(DB.src, '_prisma_migrations'),
    );
    expect(Number(count(DB.dst, '_prisma_migrations'))).toBeGreaterThan(0);
    expect(count(DB.dst, '"User"')).toBe('4');
    // read-after-write: то, что записано в источник, читается из восстановленной базы
    expect(
      psql(
        DB.dst,
        `SELECT count(*) FROM "HealthyAdultPost" WHERE text = '${MARKER}'`,
      ),
    ).toBe('1');
  });

  it('скачанный файл не открывается чужим ключом — восстановление падает, а не заливает мусор', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const file = join(dir, 'dl', `schemehappens-${today}.sql.gz.enc`);
    const res = await bash('restore-backup.sh', [file], {
      BACKUP_ENCRYPTION_KEY: 'другой-ключ-' + 'z'.repeat(24),
    });
    expect(res.code).not.toBe(0);
  });
});
