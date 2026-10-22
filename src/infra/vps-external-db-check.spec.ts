// deploy/vps/external-db-check.sh: три проверки подключения к базе на VPS (prisma
// migrate status, node-pg, psql по пути бэкапа), которые ops.sh запускает внутри
// образа приложения. Скрипт гоняется по-настоящему; prisma, psql и модуль pg
// подменены (настоящую базу и образ в юните не поднять). Главное, что доказывает
// спек: пароль, адрес сервера и URL не попадают в вывод — логи Actions публичны —
// и каждая проверка может краснеть. Сборка самой строки и вызов docker run —
// vps-ops.spec.ts; настоящее подключение проверяет живой запуск op=external-db-check.
import { spawnSync } from 'child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const SCRIPT = join(process.cwd(), 'deploy', 'vps', 'external-db-check.sh');
const PW = 'pwSECRET0123456789abcdef';
const IP = '203.0.113.7';
const URL = `postgresql://postgres:${PW}@${IP}:5432/schemehappens?sslmode=require&uselibpqcompat=true&sslaccept=accept_invalid_certs`;

// Поддельный модуль pg: режим берётся из FAKE_PG.
const FAKE_PG = `
class Client {
  async connect() {
    if (process.env.FAKE_PG === 'fail')
      throw new Error('connect ECONNREFUSED ${IP}:5432 for ' + process.env.DATABASE_URL);
  }
  async query(sql) {
    return { rows: /pg_stat_ssl/.test(sql) ? [{ ssl: process.env.FAKE_PG !== 'plain' }] : [{}] };
  }
  async end() {}
}
module.exports = { Client };
`;

describe('deploy/vps/external-db-check.sh', () => {
  let dir: string;
  let app: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ext-db-check-'));
    app = join(dir, 'app');
    const bin = join(dir, 'bin');
    mkdirSync(join(app, 'deploy'), { recursive: true });
    mkdirSync(join(app, 'node_modules', 'pg'), { recursive: true });
    mkdirSync(bin);
    copyFileSync(
      join(process.cwd(), 'deploy', 'pg-url-env.cjs'),
      join(app, 'deploy', 'pg-url-env.cjs'),
    );
    writeFileSync(join(app, 'node_modules', 'pg', 'index.js'), FAKE_PG);
    writeFileSync(
      join(bin, 'npx'),
      '#!/bin/bash\nprintf "%s\\n" "$FAKE_NPX_OUT"\nexit "${FAKE_NPX_EXIT:-0}"\n',
      { mode: 0o755 },
    );
    writeFileSync(
      join(bin, 'psql'),
      `#!/bin/bash\necho "$PGSSLMODE|$PGHOST|$PGUSER" > '${dir}/psql.env'\n` +
        'printf "%s\\n" "${FAKE_PSQL_OUT-1}"\nexit "${FAKE_PSQL_EXIT:-0}"\n',
      { mode: 0o755 },
    );
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const UP_TO_DATE =
    'Datasource "db": PostgreSQL database "schemehappens" at "203.0.113.7:5432"\n' +
    '250 migrations found in prisma/migrations\nDatabase schema is up to date!';

  function run(env: Record<string, string> = {}) {
    const res = spawnSync('bash', [SCRIPT], {
      env: {
        ...process.env,
        PATH: `${join(dir, 'bin')}:${process.env.PATH}`,
        APP_DIR: app,
        DATABASE_URL: URL,
        FAKE_NPX_OUT: UP_TO_DATE,
        ...env,
      },
      encoding: 'utf8',
      timeout: 30_000,
    });
    return {
      code: res.status,
      out: res.stdout + res.stderr,
      stdout: res.stdout,
    };
  }

  it('все три проверки зелёные → код 0, по каждой «ok», TLS подтверждён', () => {
    const res = run();

    expect(res.code).toBe(0);
    expect(res.out).toContain('1/3 prisma migrate status: ok схема актуальна');
    expect(res.out).toContain('2/3 node-pg select 1: ok соединение по TLS');
    expect(res.out).toContain('3/3 psql select 1 (путь бэкапа): ok');
    expect(res.out).not.toContain('ОШИБКА');
  });

  it('путь бэкапа: psql получает PGSSLMODE=require из строки (параметры node-pg/Prisma отброшены)', () => {
    run();
    expect(readFileSync(join(dir, 'psql.env'), 'utf8').trim()).toBe(
      `require|${IP}|postgres`,
    );
  });

  it('есть непримененные миграции — не ошибка: печатаются их имена, код 0', () => {
    const res = run({
      FAKE_NPX_EXIT: '1',
      FAKE_NPX_OUT:
        'Datasource "db" at "203.0.113.7:5432"\n250 migrations found\nFollowing migrations have not yet been applied:\n\n' +
        '20261001120000_first_new\n20261002120000_second_new\n\nTo apply migrations in development run prisma migrate dev.',
    });

    expect(res.code).toBe(0);
    expect(res.out).toContain(
      '1/3 prisma migrate status: ok соединение есть, есть непримененные',
    );
    expect(res.out).toContain('20261001120000_first_new');
    expect(res.out).toContain('20261002120000_second_new');
    expect(res.out).not.toContain('Datasource');
    expect(res.out).not.toContain(IP);
  });

  it('migrate status не достучался → ОШИБКА, код 1; пароль, адрес и URL из первой строки вычищены', () => {
    const res = run({
      FAKE_NPX_EXIT: '1',
      FAKE_NPX_OUT: `Error: P1001: Can't reach database server at ${IP}:5432 (${URL})\nвторая строка не печатается`,
    });

    expect(res.code).toBe(1);
    expect(res.out).toMatch(
      /1\/3 prisma migrate status: ОШИБКА: Error: P1001: Can't reach database server at <адрес>:5432/,
    );
    expect(res.out).not.toContain('вторая строка');
    for (const secret of [PW, IP, 'postgresql://', 'sslaccept'])
      expect(res.out).not.toContain(secret);
    // остальные проверки всё равно выполнились
    expect(res.out).toContain('2/3');
    expect(res.out).toContain('3/3');
  });

  it('node-pg не подключился → ОШИБКА, код 1, URL из сообщения драйвера вычищен', () => {
    const res = run({ FAKE_PG: 'fail' });

    expect(res.code).toBe(1);
    expect(res.out).toMatch(
      /2\/3 node-pg select 1: ОШИБКА: connect ECONNREFUSED <адрес>:5432 for <url>/,
    );
    for (const secret of [PW, IP, 'postgresql://'])
      expect(res.out).not.toContain(secret);
  });

  it('соединение без TLS сообщается явно (пароль пошёл бы открытым текстом)', () => {
    const res = run({ FAKE_PG: 'plain' });
    expect(res.out).toContain('2/3 node-pg select 1: ok соединение БЕЗ TLS');
  });

  it('psql упал → ОШИБКА, код 1; ответ psql не «1» тоже ошибка', () => {
    const failed = run({
      FAKE_PSQL_EXIT: '2',
      FAKE_PSQL_OUT: `psql: error: connection to server at "${IP}", port 5432 failed: FATAL: password authentication failed for user "postgres"`,
    });
    expect(failed.code).toBe(1);
    expect(failed.out).toMatch(
      /3\/3 psql select 1 \(путь бэкапа\): ОШИБКА: psql: error: connection to server at "<адрес>"/,
    );
    expect(failed.out).not.toContain(IP);

    const wrong = run({ FAKE_PSQL_OUT: '' });
    expect(wrong.code).toBe(1);
    expect(wrong.out).toContain('3/3 psql select 1 (путь бэкапа): ОШИБКА');
  });

  it('пароль и адрес не печатаются ни в одном исходе', () => {
    for (const env of [
      {},
      { FAKE_PG: 'fail', FAKE_NPX_EXIT: '1', FAKE_PSQL_EXIT: '1' },
    ]) {
      const res = run({ FAKE_PSQL_OUT: `${PW} ${URL}`, ...env });
      expect(res.out).not.toContain(PW);
      expect(res.out).not.toContain(URL);
    }
  });

  it('без DATABASE_URL → код 1', () => {
    expect(run({ DATABASE_URL: '' }).code).toBe(1);
  });
});
