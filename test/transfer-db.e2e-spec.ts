// Перенос БД на VPS (deploy/transfer-db.sh) на РЕАЛЬНОМ Postgres.
// Скрипт гоняет настоящие pg_dump и psql --single-transaction между двумя
// базами; мок их не заменит (правило №18: что умеет драйвер и клиент, знает
// только живая база). Источник — настоящая схема приложения (migrate deploy),
// не выдуманная фикстура (правило №23). Образец: backup-restore.spec.ts.
// Гоняется в CI-джобе `migrations` (Postgres 16 + клиент psql/pg_dump).
//
// Зачем негативные пробы: скрипт стоит между единственной боевой копией данных
// и пустым сервером. «Умеет перенести» мало — он обязан уметь ОТКАЗАТЬ, когда
// приёмник не пуст, и не замолчать, когда сверка не сошлась.
import { spawnSync } from 'child_process';
import { join } from 'path';

const SCRIPT = join(process.cwd(), 'deploy', 'transfer-db.sh');
const { pgEnvFromUrl } = jest.requireActual<{
  pgEnvFromUrl(url: string): Record<string, string>;
}>(join(process.cwd(), 'deploy', 'pg-url-env.cjs'));

jest.setTimeout(240_000);

const BASE = new URL(
  process.env.DATABASE_URL ?? 'postgresql://postgres:ci@localhost:5432/ci',
);
const SUFFIX = `${process.pid}`;
const DB = {
  src: `transfer_src_${SUFFIX}`,
  dst: `transfer_dst_${SUFFIX}`,
  hold: `transfer_hold_${SUFFIX}`,
  dirty: `transfer_dirty_${SUFFIX}`,
  plain: `transfer_plain_${SUFFIX}`,
};

const urlOf = (db: string, query = '') => {
  const u = new URL(BASE.toString());
  u.pathname = `/${db}`;
  u.search = query;
  return u.toString();
};

function psql(db: string, sql: string): string {
  const res = spawnSync(
    'psql',
    ['-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-c', sql],
    {
      env: { ...process.env, ...pgEnvFromUrl(urlOf(db)) },
      encoding: 'utf8',
    },
  );
  if (res.status !== 0) throw new Error(`psql(${db}) упал: ${res.stderr}`);
  return res.stdout.trim();
}

function runTransfer(
  target: string,
  extra: Record<string, string> = {},
  opts: { timeout?: number } = {},
) {
  return spawnSync('bash', [SCRIPT], {
    env: {
      ...process.env,
      DATABASE_URL: urlOf(DB.src),
      TRANSFER_TARGET_URL: target,
      TRANSFER_HOLD: '0',
      TRANSFER_ALLOW_NO_TLS: '1', // у Postgres в CI нет сертификата
      ...extra,
    },
    encoding: 'utf8',
    ...opts,
  });
}

// В CI и локально Postgres без TLS: sslmode=disable явно, как в тестовой среде.
const plainUrl = (db: string) => urlOf(db, '?sslmode=disable');
const MARKER = 'перенос-маркер-Ёж';

describe('deploy/transfer-db.sh на реальном Postgres', () => {
  beforeAll(() => {
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
    psql(DB.src, `INSERT INTO "User" (id) VALUES (101), (102), (103)`);
    psql(
      DB.src,
      `INSERT INTO "HealthyAdultPost" (text, source) VALUES ('${MARKER}', 'transfer-spec')`,
    );
    psql(
      DB.dirty,
      'CREATE TABLE "чужая_таблица" (a int); INSERT INTO "чужая_таблица" VALUES (1)',
    );
    psql(DB.plain, 'SELECT 1');
  });

  afterAll(() => {
    for (const db of Object.values(DB))
      psql('postgres', `DROP DATABASE IF EXISTS "${db}"`);
  });

  it('пустой приёмник: данные и схема переехали, числа сошлись, код 0', () => {
    const res = runTransfer(plainUrl(DB.dst));

    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/источник: миграций\/пользователей = \d+\/3/);
    expect(res.stdout).toMatch(/приёмник: миграций\/пользователей = \d+\/3/);
    expect(res.stdout).toContain('сверка сошлась');
    expect(res.stdout + res.stderr).not.toContain('postgresql://');
    expect(res.stdout + res.stderr).not.toContain(MARKER);
    const migs = (db: string) =>
      psql(db, 'SELECT count(*) FROM _prisma_migrations');
    expect(migs(DB.dst)).toBe(migs(DB.src));
    expect(Number(migs(DB.dst))).toBeGreaterThan(0);
    expect(psql(DB.dst, 'SELECT count(*) FROM "User"')).toBe('3');
    // read-after-write: то, что записано в источник, читается из приёмника
    expect(
      psql(
        DB.dst,
        `SELECT count(*) FROM "HealthyAdultPost" WHERE text = '${MARKER}'`,
      ),
    ).toBe('1');
  });

  it('в лог не попадают ни пароль, ни адреса подключения, ни содержимое строк', () => {
    const res = runTransfer(plainUrl(DB.dirty)); // отказ — но лог тот же
    const out = res.stdout + res.stderr;
    expect(out).not.toContain(`:${BASE.password}@`);
    expect(out).not.toContain('postgresql://');
    expect(out).not.toContain(MARKER);
  });

  it('приёмник с _prisma_migrations → отказ (код 2), ничего не изменено', () => {
    const before = psql(DB.dst, 'SELECT count(*) FROM "User"');
    psql(DB.dst, `INSERT INTO "User" (id) VALUES (999)`); // «живые» данные приёмника

    const res = runTransfer(plainUrl(DB.dst));

    expect(res.status).toBe(2);
    expect(res.stderr).toMatch(/ОТКАЗ.*_prisma_migrations: 1/);
    expect(psql(DB.dst, 'SELECT count(*) FROM "User"')).toBe(
      String(Number(before) + 1),
    );
    expect(psql(DB.dst, 'SELECT count(*) FROM "User" WHERE id = 999')).toBe(
      '1',
    );
  });

  it('приёмник с любой чужой таблицей → отказ (код 2), таблица на месте', () => {
    const res = runTransfer(plainUrl(DB.dirty));

    expect(res.status).toBe(2);
    expect(res.stderr).toMatch(/ОТКАЗ/);
    expect(psql(DB.dirty, 'SELECT count(*) FROM "чужая_таблица"')).toBe('1');
    expect(
      psql(DB.dirty, "SELECT to_regclass('_prisma_migrations') IS NULL"),
    ).toBe('t');
  });

  it('sslmode=disable без аварийного флага → конфигурация отвергнута (код 3), приёмник не тронут', () => {
    const res = runTransfer(plainUrl(DB.plain), { TRANSFER_ALLOW_NO_TLS: '' });

    expect(res.status).toBe(3);
    expect(res.stderr).toMatch(/sslmode обязан быть require/);
    expect(
      psql(DB.plain, "SELECT to_regclass('_prisma_migrations') IS NULL"),
    ).toBe('t');
  });

  it('адрес приёмника без sslmode по умолчанию требует TLS: сервер без TLS → ошибка, приёмник не тронут', () => {
    const res = runTransfer(urlOf(DB.plain));

    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/приёмник недоступен/);
    expect(
      psql(DB.plain, "SELECT to_regclass('_prisma_migrations') IS NULL"),
    ).toBe('t');
  });

  it('источник без таблиц приложения → ошибка (код 1), приёмник остаётся пустым', () => {
    const res = runTransfer(plainUrl(DB.plain), {
      DATABASE_URL: urlOf(DB.plain),
    });

    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/источник не похож на базу приложения/);
  });

  it('не заданы адреса → код 3', () => {
    expect(runTransfer('').status).toBe(3);
    expect(runTransfer(plainUrl(DB.plain), { DATABASE_URL: '' }).status).toBe(
      3,
    );
  });

  // Главный контракт для старого хостинга: entrypoint игнорирует код выхода
  // RECOVER_CMD, поэтому ВЫХОД скрипта = старт бота и второй long-polling.
  // Процесс обязан жить и после успеха, и после отказа, и после ошибки.
  describe('без TRANSFER_HOLD=0 процесс не завершается', () => {
    const alive = (target: string, extra: Record<string, string> = {}) =>
      runTransfer(target, { TRANSFER_HOLD: '1', ...extra }, { timeout: 8000 });

    it('успех: сверка сошлась и процесс жив (убит только таймаутом теста)', () => {
      const res = alive(plainUrl(DB.hold));

      expect(res.error).toMatchObject({ code: 'ETIMEDOUT' });
      expect(res.stdout).toContain('сверка сошлась');
      expect(res.stdout).toContain(
        'приложение на этом хостинге намеренно не стартует',
      );
      expect(psql(DB.hold, 'SELECT count(*) FROM "User"')).toBe('3');
    });

    it('отказ (приёмник не пуст): процесс жив', () => {
      const res = alive(plainUrl(DB.hold));

      expect(res.error).toMatchObject({ code: 'ETIMEDOUT' });
      expect(res.stderr).toMatch(/ОТКАЗ/);
      expect(res.stdout).toMatch(/ПЕРЕНОС НЕ ВЫПОЛНЕН \(код 2\)/);
    });

    it('ошибка конфигурации: процесс жив', () => {
      const res = alive(plainUrl(DB.plain), { TRANSFER_ALLOW_NO_TLS: '' });

      expect(res.error).toMatchObject({ code: 'ETIMEDOUT' });
      expect(res.stdout).toMatch(/ПЕРЕНОС НЕ ВЫПОЛНЕН \(код 3\)/);
    });
  });
});
