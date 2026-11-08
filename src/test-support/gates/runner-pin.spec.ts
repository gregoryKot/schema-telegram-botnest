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

// Образ ubuntu-26.04 несёт PostgreSQL 18 и удаляет репозиторий PGDG после
// сборки, а сервис джоб — Postgres 16: pg_dump 17+ пишет `SET
// transaction_timeout`, которого в 16 нет. `command -v psql || apt-get install
// postgresql-client-16` на таком образе молча оставлял бы клиент 18, а пакет
// клиента 16 без PGDG не находится. Поэтому: PGDG, затем bin 16 первым в PATH
// (обёртка pg_wrapper иначе выберет 18-й).
export function pgClientProblems(text: string): string[] {
  const bad: string[] = [];
  for (const [id, block] of Object.entries(jobBlocks(text))) {
    if (!/postgresql-client-16/.test(block)) continue;
    if (!/apt\.postgresql\.org/.test(block))
      bad.push(`${id}: клиент 16 не из PGDG`);
    if (!/echo \/usr\/lib\/postgresql\/16\/bin >> "\$GITHUB_PATH"/.test(block))
      bad.push(`${id}: bin клиента 16 не первым в PATH`);
    if (/command -v (?:psql|pg_dump)[^\n]*postgresql-client-16/.test(block))
      bad.push(
        `${id}: установка клиента 16 за «command -v» — на образе с 18 не сработает`,
      );
  }
  return bad;
}

describe('клиент Postgres 16 на раннере', () => {
  const job = (steps: string) =>
    `name: X\n\non:\n  push:\n\njobs:\n  db:\n    runs-on: ${UBUNTU}\n    timeout-minutes: 5\n    steps:\n${steps}`;
  const GOOD = [
    '      - run: |',
    '          echo "deb [signed-by=k] https://apt.postgresql.org/pub/repos/apt x-pgdg main" | sudo tee l',
    '          sudo apt-get install -y postgresql-client-16',
    '          echo /usr/lib/postgresql/16/bin >> "$GITHUB_PATH"',
    '',
  ].join('\n');

  it('PGDG + bin 16 в GITHUB_PATH — без замечаний', () => {
    expect(pgClientProblems(job(GOOD))).toEqual([]);
  });

  it('старая форма «command -v psql || apt-get install» — красная по всем трём пунктам', () => {
    const old = job(
      '      - run: command -v psql >/dev/null || sudo apt-get install -y postgresql-client-16\n',
    );
    expect(pgClientProblems(old)).toEqual([
      'db: клиент 16 не из PGDG',
      'db: bin клиента 16 не первым в PATH',
      'db: установка клиента 16 за «command -v» — на образе с 18 не сработает',
    ]);
  });

  it('контроль: джоба без клиента 16 гейту не интересна', () => {
    expect(
      pgClientProblems(job('      - run: npx prisma migrate deploy\n')),
    ).toEqual([]);
  });

  it.each(files)('%s: клиент 16 ставится как надо', (f) => {
    expect(pgClientProblems(readFileSync(join(DIR, f), 'utf8'))).toEqual([]);
  });
});
