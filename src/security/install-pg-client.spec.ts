// Установка клиента Postgres 16 в runtime-образ (deploy/install-pg-client.sh,
// аудит D-2): без pg_dump/psql зашифрованные бэкапы в B2 просто не запустятся,
// а образ с ними «молча без клиента» — тот же класс, что инцидент 2026-08-08
// с openssl (сеть билдера Amvera до зарубежных хостов отваливается).
//
// Скрипт гоняется по-настоящему, с подставными apt-get/curl/pg_dump/psql в
// PATH. Держим оба исхода: ретрай на зеркалах доводит установку, а образ без
// клиента не собирается.
import { execFileSync } from 'child_process';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  chmodSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const SCRIPT = join(__dirname, '../../deploy/install-pg-client.sh');
const DOCKERFILE = readFileSync(join(__dirname, '../../Dockerfile'), 'utf8');

interface Sandbox {
  dir: string;
  sources: string;
  pgdgList: string;
  pgdgKey: string;
  curlLog: string;
  aptLog: string;
  run(): { code: number; out: string };
}

function sandbox(opts: {
  /** Сколько первых `apt-get update` падают (сеть). */
  failures: number;
  pgVersion?: string;
  keyFetchFails?: boolean;
}): Sandbox {
  const dir = mkdtempSync(join(tmpdir(), 'install-pg-client-'));
  const bin = join(dir, 'bin');
  mkdirSync(bin);
  const stub = (name: string, body: string) => {
    const file = join(bin, name);
    writeFileSync(file, `#!/bin/sh\n${body}\n`);
    chmodSync(file, 0o755);
  };
  const counter = join(dir, 'updates');
  const aptLog = join(dir, 'apt.log');
  const curlLog = join(dir, 'curl.log');
  writeFileSync(counter, '');
  stub(
    'apt-get',
    [
      `echo "$@" >> ${aptLog}`,
      `[ "$1" = update ] || exit 0`,
      `echo x >> ${counter}`,
      `n=$(wc -l < ${counter})`,
      `[ "$n" -gt ${opts.failures} ]`,
    ].join('\n'),
  );
  // curl: пишет «ключ» в файл после -o, адрес (последний аргумент) — в лог.
  stub(
    'curl',
    [
      `for a; do last=$a; done`,
      `echo "$last" >> ${curlLog}`,
      opts.keyFetchFails ? 'exit 22' : '',
      `while [ $# -gt 0 ]; do [ "$1" = -o ] && { echo KEY > "$2"; }; shift; done`,
    ].join('\n'),
  );
  const ver = opts.pgVersion ?? '16.4';
  stub('pg_dump', `echo "pg_dump (PostgreSQL) ${ver}"`);
  stub('psql', `echo "psql (PostgreSQL) ${ver}"`);
  stub('sleep', 'exit 0');

  const sources = join(dir, 'sources.list');
  writeFileSync(sources, 'deb http://deb.debian.org/debian bookworm main\n');
  const osRelease = join(dir, 'os-release');
  writeFileSync(osRelease, 'VERSION_CODENAME=bookworm\nID=debian\n');
  const pgdgList = join(dir, 'pgdg.list');
  const pgdgKey = join(dir, 'keys', 'pgdg.asc');

  return {
    dir,
    sources,
    pgdgList,
    pgdgKey,
    curlLog,
    aptLog,
    run() {
      try {
        const out = execFileSync('sh', [SCRIPT], {
          env: {
            ...process.env,
            PATH: `${bin}:${process.env.PATH}`,
            APT_SOURCES: sources,
            APT_LISTS: join(dir, 'lists'),
            OS_RELEASE: osRelease,
            PGDG_LIST: pgdgList,
            PGDG_KEY: pgdgKey,
          },
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        return { code: 0, out };
      } catch (e) {
        const err = e as { status: number; stdout?: string; stderr?: string };
        return {
          code: err.status,
          out: `${err.stdout ?? ''}${err.stderr ?? ''}`,
        };
      }
    },
  };
}

describe('deploy/install-pg-client.sh', () => {
  it('сеть в порядке — репозиторий PGDG для bookworm, ключ в signed-by, ставит postgresql-client-16', () => {
    const s = sandbox({ failures: 0 });
    expect(s.run().code).toBe(0);
    const list = readFileSync(s.pgdgList, 'utf8');
    expect(list).toBe(
      `deb [signed-by=${s.pgdgKey}] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main\n`,
    );
    expect(existsSync(s.pgdgKey)).toBe(true);
    expect(readFileSync(s.curlLog, 'utf8').split('\n')[0]).toBe(
      'https://apt.postgresql.org/pub/repos/apt/ACCC4CF8.asc',
    );
    const apt = readFileSync(s.aptLog, 'utf8');
    expect(apt).toContain(
      'install -y --no-install-recommends postgresql-client-16',
    );
    expect(apt).toContain(
      'install -y --no-install-recommends ca-certificates curl',
    );
    // Зеркало не трогаем, пока основной адрес отвечает.
    expect(readFileSync(s.sources, 'utf8')).toContain('deb.debian.org');
  });

  // Инцидентный сценарий: первая попытка упала из-за чужой сети.
  it('первая попытка упала — переключается на зеркала (Debian и PGDG) и доводит установку', () => {
    const s = sandbox({ failures: 1 });
    expect(s.run().code).toBe(0);
    const sources = readFileSync(s.sources, 'utf8');
    expect(sources).toContain('mirror.yandex.ru');
    expect(sources).not.toContain('deb.debian.org');
    expect(readFileSync(s.pgdgList, 'utf8')).toContain(
      'https://mirror.yandex.ru/mirrors/postgresql/pub/repos/apt bookworm-pgdg main',
    );
    expect(readFileSync(s.curlLog, 'utf8').split('\n')[0]).toBe(
      'https://mirror.yandex.ru/mirrors/postgresql/pub/repos/apt/ACCC4CF8.asc',
    );
  });

  it('все попытки провалились — падает громко, образ без клиента не собирается', () => {
    const { code, out } = sandbox({ failures: 99 }).run();
    expect(code).toBe(1);
    expect(out).toContain('клиент Postgres 16 не поставлен');
  });

  it('ключ репозитория не скачался ни разу — тоже падает', () => {
    expect(sandbox({ failures: 0, keyFetchFails: true }).run().code).toBe(1);
  });

  // Версия обязана быть 16: pg_dump отказывается снимать дамп с сервера новее себя.
  it('«поставился» клиент не той версии (15) — падает', () => {
    const { code, out } = sandbox({ failures: 0, pgVersion: '15.8' }).run();
    expect(code).toBe(1);
    expect(out).toContain('не 16-й версии');
  });

  it('контроль: версия 16.14 принимается (проверка не слишком строга)', () => {
    expect(sandbox({ failures: 0, pgVersion: '16.14' }).run().code).toBe(0);
  });
});

describe('Dockerfile: клиент Postgres и скрипты бэкапа в runtime-стадии', () => {
  const runtime = DOCKERFILE.slice(DOCKERFILE.lastIndexOf('FROM node:22-slim'));
  const build = DOCKERFILE.slice(
    0,
    DOCKERFILE.lastIndexOf('FROM node:22-slim'),
  );

  it('установщик зовётся в runtime и не зовётся в build (там клиент не нужен)', () => {
    expect(runtime).toMatch(/sh \/tmp\/install-pg-client\.sh/);
    expect(build).not.toMatch(/install-pg-client/);
  });

  it('скрипты бэкапа и восстановления попадают в образ (планировщик запускает scripts/backup-to-b2.sh)', () => {
    expect(runtime).toMatch(/scripts\/backup-to-b2\.sh/);
    expect(runtime).toMatch(/scripts\/restore-backup\.sh/);
  });

  it('deploy/ копируется целиком — планировщик и pg-url-env.cjs приезжают вместе с entrypoint', () => {
    expect(runtime).toMatch(/COPY --from=build[^\n]*\/app\/deploy \.\/deploy/);
  });
});
