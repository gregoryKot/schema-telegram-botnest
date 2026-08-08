// Установка openssl в образ (deploy/install-openssl.sh). Инцидент 2026-08-08:
// билдер Amvera не достучался до deb.debian.org («Network is unreachable»),
// одна строка `apt-get install` уронила сборку с exit 100 — и срочный фикс
// входа в мини-апп не доехал до пользователей.
//
// Скрипт прогоняется по-настоящему, с подставным `apt-get` в PATH: настоящий
// apt в тестах не нужен, а логика повтора и переключения на зеркало проверяема
// только исполнением. Тест держит ОБА исхода — и что образ не собирается молча
// без openssl.
import { execFileSync } from 'child_process';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  chmodSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const SCRIPT = join(__dirname, '../../deploy/install-openssl.sh');
const DOCKERFILE = readFileSync(join(__dirname, '../../Dockerfile'), 'utf8');

interface Sandbox {
  dir: string;
  sources: string;
  run(): { code: number; out: string };
}

/**
 * Песочница: подставные `apt-get` (падает первые `failures` раз), `openssl`,
 * `sleep` (мгновенный — иначе тест ждал бы паузы между попытками).
 */
function sandbox(opts: { failures: number; opensslOk?: boolean }): Sandbox {
  const dir = mkdtempSync(join(tmpdir(), 'install-openssl-'));
  const bin = join(dir, 'bin');
  mkdirSync(bin);
  const stub = (name: string, body: string) => {
    const file = join(bin, name);
    writeFileSync(file, `#!/bin/sh\n${body}\n`);
    chmodSync(file, 0o755);
  };
  // Счётчик попыток в файле: каждый вызов apt-get — новый процесс.
  const counter = join(dir, 'attempts');
  writeFileSync(counter, '');
  stub(
    'apt-get',
    [
      `[ "$1" = update ] || exit 0`,
      `echo x >> ${counter}`,
      `n=$(wc -l < ${counter})`,
      `[ "$n" -gt ${opts.failures} ]`,
    ].join('\n'),
  );
  stub('openssl', opts.opensslOk === false ? 'exit 1' : 'echo "OpenSSL 3.0.0"');
  stub('sleep', 'exit 0');

  const sources = join(dir, 'sources.list');
  writeFileSync(sources, 'deb http://deb.debian.org/debian bookworm main\n');

  return {
    dir,
    sources,
    run() {
      try {
        const out = execFileSync('sh', [SCRIPT], {
          env: {
            ...process.env,
            PATH: `${bin}:${process.env.PATH}`,
            APT_SOURCES: sources,
            APT_LISTS: join(dir, 'lists'),
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

describe('deploy/install-openssl.sh', () => {
  it('сеть в порядке — ставит с первой попытки, зеркало не трогает', () => {
    const s = sandbox({ failures: 0 });
    expect(s.run().code).toBe(0);
    expect(readFileSync(s.sources, 'utf8')).toContain('deb.debian.org');
  });

  // Ровно инцидентный сценарий: первая попытка упала из-за чужой сети.
  it('первая попытка упала — переключается на зеркало и доводит установку', () => {
    const s = sandbox({ failures: 1 });
    const { code } = s.run();
    expect(code).toBe(0);
    const sources = readFileSync(s.sources, 'utf8');
    expect(sources).toContain('mirror.yandex.ru');
    expect(sources).not.toContain('deb.debian.org');
  });

  // Второй исход не менее важен: молча собранный образ без libssl падает уже
  // на проде, поэтому недоступность зеркал обязана ронять сборку.
  it('все попытки провалились — падает громко, а не «как-нибудь»', () => {
    const { code, out } = sandbox({ failures: 99 }).run();
    expect(code).toBe(1);
    expect(out).toContain('openssl не поставлен');
  });

  it('пакет «поставился», но openssl не работает — тоже падает', () => {
    expect(sandbox({ failures: 0, opensslOk: false }).run().code).not.toBe(0);
  });
});

describe('Dockerfile: openssl в обеих стадиях', () => {
  // Runtime-стадия без openssl = Prisma не стартует; build-стадия без него —
  // `prisma generate` берёт не тот движок. Обе обязаны звать один скрипт.
  it('скрипт вызывается дважды — в build и в runtime', () => {
    const calls = DOCKERFILE.match(/sh \/tmp\/install-openssl\.sh/g) ?? [];
    expect(calls).toHaveLength(2);
  });

  it('голого apt-get install openssl в образе не осталось', () => {
    expect(DOCKERFILE).not.toMatch(/apt-get install[^\n]*openssl/);
  });
});
