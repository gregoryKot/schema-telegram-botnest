// Гейт «образ раннера закреплён версией» (2026-10-20). С 19 октября GitHub
// переводит ubuntu-latest на Ubuntu 26, и на следующий день два несвязанных
// фронтовых PR покраснели на храповике покрытия бэкенда и e2e с `pg_dump` —
// при зелёном локальном прогоне. Плавающая метка меняет среду CI без коммита
// в репозитории: красное появляется у того, кто ничего не трогал. Переход на
// новый образ — правка `runs-on` в отдельном PR, а не сюрприз.
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { jobBlocks } from './workflow-yaml';

const DIR = join(process.cwd(), '.github', 'workflows');
const files = readdirSync(DIR).filter((f) => f.endsWith('.yml'));

/** Джобы, чей `runs-on` — плавающая метка `*-latest`. */
export function floatingRunners(text: string): string[] {
  const bad: string[] = [];
  for (const [id, block] of Object.entries(jobBlocks(text))) {
    const m = /^ {4}runs-on:[ \t]*(\S+)/m.exec(block);
    if (m && /-latest\b/.test(m[1])) bad.push(`${id}: runs-on: ${m[1]}`);
  }
  return bad;
}

const wf = (runsOn: string) =>
  `name: X\n\non:\n  push:\n\njobs:\n  build:\n    runs-on: ${runsOn}\n    timeout-minutes: 5\n    steps:\n      - run: true\n`;

describe('плавающая метка образа — красная', () => {
  it('ubuntu-latest называет джобу', () => {
    expect(floatingRunners(wf('ubuntu-latest'))).toEqual([
      'build: runs-on: ubuntu-latest',
    ]);
  });

  it('любая *-latest, не только ubuntu', () => {
    expect(floatingRunners(wf('macos-latest'))).toHaveLength(1);
  });

  it('контроль: закреплённая версия проходит', () => {
    expect(floatingRunners(wf('ubuntu-24.04'))).toEqual([]);
  });

  it('контроль: строка шага с ubuntu-latest не считается образом джобы', () => {
    const text = wf('ubuntu-24.04').replace(
      '      - run: true',
      '      - run: echo ubuntu-latest',
    );
    expect(floatingRunners(text)).toEqual([]);
  });
});

describe('настоящие воркфлоу', () => {
  it('воркфлоу найдены', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('%s: образ закреплён версией', (f) => {
    expect(floatingRunners(readFileSync(join(DIR, f), 'utf8'))).toEqual([]);
  });
});

// Переход на Ubuntu 26 (#789) — одной правкой во всех воркфлоу: джоба,
// забытая на старом образе, держала бы вторую среду CI. Следующий переход —
// правка этой константы в том же PR, что и `runs-on`.
const UBUNTU = 'ubuntu-26.04';

/** `runs-on` всех джоб воркфлоу: [джоба, метка]. */
const runners = (text: string) =>
  Object.entries(jobBlocks(text)).map(
    ([id, block]) =>
      [id, /^ {4}runs-on:[ \t]*(\S+)/m.exec(block)?.[1] ?? ''] as const,
  );

describe(`ubuntu-джобы — на ${UBUNTU}`, () => {
  it.each(files)('%s', (f) => {
    const stale = runners(readFileSync(join(DIR, f), 'utf8')).filter(
      ([, label]) => label.startsWith('ubuntu-') && label !== UBUNTU,
    );
    expect(stale).toEqual([]);
  });
});

// Версия Postgres в CI = версия прода = версия клиента. Прод — Postgres 17
// (Amvera, 17.5), и мажор клиента задаёт одна константа: `PG_MAJOR` в
// deploy/install-pg-client.sh, тем же скриптом клиент ставится и в образ, и в
// джобы CI. Образ ubuntu-26.04 несёт PostgreSQL 18 и удаляет репозиторий PGDG
// после сборки, поэтому клиент ставится только из PGDG, а его bin идёт первым в
// PATH (обёртка pg_wrapper иначе выберет 18-й). Рассинхрон версий — дамп 17 не
// заливается в 16 (#789), миграции и восстановление проверяются не на той
// версии, что в проде (2026-11-13: CI и nightly сидели на 16 при проде 17.5).
const PG_SCRIPT = 'deploy/install-pg-client.sh';
const PG_MAJOR =
  /^PG_MAJOR=(\d+)$/m.exec(
    readFileSync(join(process.cwd(), PG_SCRIPT), 'utf8'),
  )?.[1] ?? '';

export function pgVersionProblems(text: string, major: string): string[] {
  const bad: string[] = [];
  for (const [id, block] of Object.entries(jobBlocks(text))) {
    for (const m of block.matchAll(
      /^\s*image:[ \t]*(?:\S*\/)?postgres:(\d+)/gm,
    )) {
      if (m[1] !== major)
        bad.push(`${id}: сервис postgres:${m[1]}, прод и клиент — ${major}`);
    }
    for (const m of block.matchAll(/\/usr\/lib\/postgresql\/(\d+)\/bin/g)) {
      if (m[1] !== major)
        bad.push(`${id}: bin клиента ${m[1]}, а клиент — ${major}`);
    }
    if (/postgresql-client-\d+/.test(block))
      bad.push(
        `${id}: клиент ставится мимо ${PG_SCRIPT} — версия и ретраи не в одном месте`,
      );
    if (!block.includes('install-pg-client.sh')) continue;
    if (
      !new RegExp(
        `echo /usr/lib/postgresql/${major}/bin >> "\\$GITHUB_PATH"`,
      ).test(block)
    )
      bad.push(`${id}: bin клиента ${major} не первым в PATH`);
    if (/command -v (?:psql|pg_dump)[^\n]*install-pg-client\.sh/.test(block))
      bad.push(
        `${id}: установка клиента за «command -v» — на образе с 18 не сработает`,
      );
  }
  return bad;
}

describe('версия Postgres: сервисы CI, клиент и прод', () => {
  const job = (steps: string, image = 'mirror.gcr.io/library/postgres:17') =>
    `name: X\n\non:\n  push:\n\njobs:\n  db:\n    runs-on: ${UBUNTU}\n    timeout-minutes: 5\n    services:\n      postgres:\n        image: ${image}\n    steps:\n${steps}`;
  const GOOD = [
    '      - run: |',
    '          sudo env PATH="/usr/lib/postgresql/17/bin:$PATH" sh deploy/install-pg-client.sh',
    '          echo /usr/lib/postgresql/17/bin >> "$GITHUB_PATH"',
    '',
  ].join('\n');

  it('мажор прода найден в скрипте установки клиента', () => {
    expect(PG_MAJOR).toMatch(/^\d+$/);
  });

  it('сервис 17 + скрипт клиента + bin 17 в GITHUB_PATH — без замечаний', () => {
    expect(pgVersionProblems(job(GOOD), '17')).toEqual([]);
  });

  it('сервис postgres:16 при клиенте 17 — красный', () => {
    expect(
      pgVersionProblems(job(GOOD, 'mirror.gcr.io/library/postgres:16'), '17'),
    ).toEqual(['db: сервис postgres:16, прод и клиент — 17']);
  });

  it('образ без зеркала и с тегом-суффиксом тоже сверяется', () => {
    expect(
      pgVersionProblems(job(GOOD, 'postgres:16-alpine'), '17'),
    ).toHaveLength(1);
    expect(pgVersionProblems(job(GOOD, 'postgres:17.5-alpine'), '17')).toEqual(
      [],
    );
  });

  it('bin клиента другой версии — красный, и «не первым в PATH» тоже', () => {
    const stale = GOOD.replace(/postgresql\/17\/bin/g, 'postgresql/16/bin');
    expect(pgVersionProblems(job(stale), '17')).toEqual([
      'db: bin клиента 16, а клиент — 17',
      'db: bin клиента 16, а клиент — 17',
      'db: bin клиента 17 не первым в PATH',
    ]);
  });

  it('старая форма — apt install мимо скрипта — красная', () => {
    const old = job(
      '      - run: command -v psql >/dev/null || sudo apt-get install -y postgresql-client-17\n',
    );
    expect(pgVersionProblems(old, '17')).toEqual([
      'db: клиент ставится мимо deploy/install-pg-client.sh — версия и ретраи не в одном месте',
    ]);
  });

  it('скрипт клиента за «command -v» — красный', () => {
    const guarded = job(
      '      - run: command -v psql >/dev/null || sh deploy/install-pg-client.sh\n',
    );
    expect(pgVersionProblems(guarded, '17')).toEqual([
      'db: bin клиента 17 не первым в PATH',
      'db: установка клиента за «command -v» — на образе с 18 не сработает',
    ]);
  });

  it('контроль: джоба без клиента и без сервиса гейту не интересна', () => {
    const plain = `name: X\n\non:\n  push:\n\njobs:\n  db:\n    runs-on: ${UBUNTU}\n    timeout-minutes: 5\n    steps:\n      - run: npx prisma migrate deploy\n`;
    expect(pgVersionProblems(plain, '17')).toEqual([]);
  });

  it.each(files)('%s: версии сходятся с продом', (f) => {
    expect(
      pgVersionProblems(readFileSync(join(DIR, f), 'utf8'), PG_MAJOR),
    ).toEqual([]);
  });

  it('гейт не вхолостую: в воркфлоу есть и сервисы postgres, и установка клиента', () => {
    const all = files.map((f) => readFileSync(join(DIR, f), 'utf8')).join('\n');
    expect(all).toMatch(new RegExp(`library/postgres:${PG_MAJOR}\\b`));
    expect(all).toContain('sh deploy/install-pg-client.sh');
  });
});
