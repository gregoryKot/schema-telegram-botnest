// deploy/pg-url-env.cjs: DATABASE_URL → PG*-переменные (пароль БД не должен
// попадать в командную строку pg_dump/psql, аудит D-2).
import { execFileSync, spawnSync } from 'child_process';
import { join } from 'path';

const MOD = join(process.cwd(), 'deploy', 'pg-url-env.cjs');
const { pgEnvFromUrl, toShellExports } = jest.requireActual<{
  pgEnvFromUrl(u: string): Record<string, string>;
  toShellExports(e: Record<string, string>): string;
}>(MOD);

describe('pgEnvFromUrl', () => {
  it('раскладывает полный URL по переменным libpq', () => {
    expect(
      pgEnvFromUrl(
        'postgresql://user:pass@host.example:6543/mydb?sslmode=require',
      ),
    ).toEqual({
      PGHOST: 'host.example',
      PGPORT: '6543',
      PGUSER: 'user',
      PGPASSWORD: 'pass',
      PGDATABASE: 'mydb',
      PGSSLMODE: 'require',
    });
  });

  it('percent-кодированные логин/пароль декодируются', () => {
    const env = pgEnvFromUrl('postgres://us%40er:p%2Fa%20ss@h/db');
    expect(env.PGUSER).toBe('us@er');
    expect(env.PGPASSWORD).toBe('p/a ss');
  });

  it('prisma-овский ?schema=public libpq не передаётся (иначе pg_dump упал бы)', () => {
    const env = pgEnvFromUrl('postgresql://u:p@h/db?schema=public');
    expect(Object.keys(env)).not.toContain('PGSCHEMA');
    expect(JSON.stringify(env)).not.toContain('schema');
  });

  it('IPv6-хост — без скобок', () => {
    expect(pgEnvFromUrl('postgresql://u:p@[::1]:5432/d').PGHOST).toBe('::1');
  });

  it.each(['не url', 'mysql://u:p@h/db', ''])(
    'не-Postgres/мусор «%s» — ошибка без самого значения в тексте',
    (bad) => {
      expect(() => pgEnvFromUrl(bad)).toThrow(/DATABASE_URL/);
      try {
        pgEnvFromUrl(bad);
      } catch (e) {
        expect((e as Error).message).not.toContain('mysql://u:p');
      }
    },
  );
});

describe('toShellExports + CLI', () => {
  it('одинарная кавычка и спецсимволы в значении не ломают shell', () => {
    const url = 'postgresql://u:p\'a$b`c"d;e@h/db';
    const exports = toShellExports(pgEnvFromUrl(url));
    const out = execFileSync(
      'bash',
      ['-c', `${exports}\nprintf '%s' "$PGPASSWORD"`],
      { encoding: 'utf8' },
    );
    expect(out).toBe('p\'a$b`c"d;e');
  });

  it('CLI читает DATABASE_URL из окружения и печатает export-строки', () => {
    const out = execFileSync('node', [MOD], {
      env: { ...process.env, DATABASE_URL: 'postgresql://u:p@h:1/d' },
      encoding: 'utf8',
    });
    expect(out).toContain("export PGHOST='h'");
    expect(out).toContain("export PGPASSWORD='p'");
  });

  it('CLI на мусоре — код 1 и сообщение без значения', () => {
    const res = spawnSync('node', [MOD], {
      env: { ...process.env, DATABASE_URL: 'secret-nonsense' },
      encoding: 'utf8',
    });
    expect(res.status).toBe(1);
    expect(res.stderr).not.toContain('secret-nonsense');
  });
});
