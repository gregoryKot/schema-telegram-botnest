// Тест гейта check-pr-size.mjs: PR сверх 60 файлов или 1500 строк краснеет.
// Шов — настоящий git: база лежит в refs/remotes/origin/main, ветка — вторым
// коммитом, гейт запускается так же, как в CI. Оба исхода, границы, что не
// считается, метка-обход и список EXCLUDED по имени (правило №15).
import { mkdirSync, writeFileSync } from 'fs';
import { spawnSync } from 'child_process';
import { dirname, join } from 'path';
import { runGate, type GateResult } from './gate-sandbox';
import { loadRegexList } from './pattern-loader';

const COMMIT =
  '-c user.name=gate -c user.email=gate@example.invalid -c commit.gpgsign=false commit -q -m';

function git(cwd: string, ...args: string[]): void {
  const res = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (res.status !== 0) throw new Error(`git ${args.join(' ')}: ${res.stderr}`);
}

function write(tmp: string, files: Record<string, string>): void {
  for (const [rel, content] of Object.entries(files)) {
    mkdirSync(dirname(join(tmp, rel)), { recursive: true });
    writeFileSync(join(tmp, rel), content);
  }
}

/** `n` разных строк с завершающим переводом строки. */
const text = (n: number, tag = 'line'): string =>
  Array.from({ length: n }, (_, i) => `${tag} ${i}\n`).join('');

/** `n` файлов `<dir>/f<i>.txt` по `perFile` строк; содержимое у всех разное. */
const many = (n: number, dir = 'src', perFile = 1): Record<string, string> =>
  Object.fromEntries(
    Array.from({ length: n }, (_, i) => [
      `${dir}/f${i}.txt`,
      text(perFile, `${dir}${i}`),
    ]),
  );

interface Scenario {
  base?: Record<string, string>; // файлы origin/main
  moves?: Array<[from: string, to: string]>; // `git mv` до записи файлов ветки
  branch: Record<string, string>;
  labels?: string[]; // метки PR в событии; не заданы — события нет
  noOriginMain?: boolean;
}

function run(s: Scenario): GateResult {
  const env: Record<string, string> = { PATH: process.env.PATH ?? '' };
  const setup = (tmp: string): void => {
    git(tmp, 'init', '-q');
    write(tmp, { 'README.md': 'base\n', ...s.base });
    git(tmp, 'add', '-A');
    git(tmp, ...COMMIT.split(' '), 'base');
    if (!s.noOriginMain)
      git(tmp, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
    for (const [from, to] of s.moves ?? []) {
      mkdirSync(dirname(join(tmp, to)), { recursive: true });
      git(tmp, 'mv', from, to);
    }
    write(tmp, s.branch);
    git(tmp, 'add', '-A');
    git(tmp, ...COMMIT.split(' '), 'branch');
    if (!s.labels) return;
    // Событие пишется после коммита ветки: в дифф оно не попадает.
    const labels = s.labels.map((name) => ({ name }));
    write(tmp, { 'event.json': JSON.stringify({ pull_request: { labels } }) });
    env.GITHUB_EVENT_PATH = join(tmp, 'event.json');
  };
  return runGate('check-pr-size.mjs', {}, { env, setup });
}

describe('check-pr-size.mjs', () => {
  it('зелёный: пара файлов, десяток строк', () => {
    const res = run({ branch: { 'src/a.ts': text(6), 'src/b.ts': text(4) } });
    expect(res.stdout.trim()).toBe(
      '✓ размер PR: 2 файлов, 10 строк (лимит 60 и 1500).',
    );
    expect(res.status).toBe(0);
  });

  it('граница: ровно 60 файлов и 1500 строк — ещё зелёный', () => {
    const res = run({ branch: many(60, 'src', 25) });
    expect(res.stdout).toContain('60 файлов, 1500 строк');
    expect(res.status).toBe(0);
  });

  it('61 файл — красный: число и что делать', () => {
    const res = run({ branch: many(61) });
    expect(res.status).toBe(1);
    const lines = res.stderr.trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('✗ размер PR: 61 файлов, 61 строк');
    expect(lines[1]).toMatch(/^Что делать: .*метку big-pr/);
  });

  it('один файл на 1501 строку — красный', () => {
    const res = run({ branch: { 'src/big.ts': text(1501) } });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('1 файлов, 1501 строк');
  });

  it('не считаются фикстуры, бейслайны, lock-файлы и чистые переименования; переименование с правкой и бинарный файл считаются', () => {
    const res = run({
      base: {
        ...many(70, 'old', 3),
        'src/before.ts': text(20),
        'src/sample.json': text(20, 'json'),
        'assets/pic.bin': '\0\x03\x04',
      },
      moves: [
        ['old', 'moved'],
        ['assets/pic.bin', 'img/pic.bin'],
        ['src/before.ts', 'src/after.ts'],
        ['src/sample.json', 'test/fixtures/sample.json'],
      ],
      branch: {
        ...many(80, 'test/fixtures/recorded', 30),
        'scripts/x-baseline.json': text(3000),
        'webapp/package-lock.json': text(3000),
        'src/after.ts': text(20) + text(2, 'new'),
        'test/fixtures/sample.json': text(20, 'json') + text(2, 'new'),
        'src/logo.bin': '\0\x01\x02',
      },
    });
    expect(res.stdout.trim()).toBe(
      '✓ размер PR: 2 файлов, 2 строк (лимит 60 и 1500).',
    );
    expect(res.status).toBe(0);
  });

  it('метка big-pr пропускает PR сверх лимита; другая метка — нет', () => {
    const labelled = run({ branch: many(61), labels: ['bug', 'big-pr'] });
    expect(labelled.stdout).toContain('61 файлов');
    expect(labelled.stdout).toContain('пропущено меткой big-pr');
    expect(labelled.status).toBe(0);
    expect(run({ branch: many(61), labels: ['bug'] }).status).toBe(1);
  });

  it('нет origin/main — красный с подсказкой, а не молчаливый зелёный', () => {
    const res = run({ branch: { 'src/a.ts': text(1) }, noOriginMain: true });
    expect(res.status).toBe(1);
    expect(res.stderr.trim().split('\n')).toHaveLength(1);
    expect(res.stderr).toContain('не удалось сравнить с origin/main');
    expect(res.stderr).toContain('git fetch origin main');
  });
});

describe('EXCLUDED не шире, чем нужно', () => {
  const EXCLUDED = loadRegexList('check-pr-size.mjs', 'EXCLUDED').map(
    (p) => new RegExp(p.source, p.flags),
  );
  // В порядке списка: путь, который запись гасит, и похожие, которые считаются.
  const SAMPLES: Array<[hit: string, ...miss: string[]]> = [
    ['scripts/x-baseline.json', 'scripts/baseline.json'],
    ['webapp/package-lock.json', 'docs/package-lock.json.md'],
    ['test/fixtures/a.json', 'src/test/fixtures/a.json', 'test/fixtures.ts'],
  ];

  it('у каждой записи есть образец и контрольный образец', () => {
    expect(EXCLUDED).toHaveLength(SAMPLES.length);
    SAMPLES.forEach(([hit, ...miss], i) => {
      expect(hit).toMatch(EXCLUDED[i]);
      expect(miss.filter((p) => EXCLUDED.some((re) => re.test(p)))).toEqual([]);
    });
  });
});
