// Пин «PR только из документов проходит CI за минуты»: ci.yml считает дифф шагом
// scripts/ci-docs-only.mjs, а тяжёлые джобы пропускают шаги, оставаясь зелёными
// (обязательные проверки ruleset должны отчитаться, job-level `if` и paths-ignore не берём).
// Два исхода: только документы → лёгкий круг; документ + код → полный.
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { spawnSync } from 'child_process';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { jobBlocks } from './workflow-yaml';

const SCRIPT = join(process.cwd(), 'scripts', 'ci-docs-only.mjs');

/** Настоящий git: база и коммит PR с файлами `files`; результат — docs_only из $GITHUB_OUTPUT. */
function docsOnly(
  files: string[],
  event = 'pull_request',
  args: string[] = [],
): string {
  const dir = mkdtempSync(join(tmpdir(), 'docs-only-'));
  const git = (...a: string[]) => {
    const r = spawnSync(
      'git',
      [
        '-c',
        'user.name=t',
        '-c',
        'user.email=t@example.invalid',
        '-c',
        'commit.gpgsign=false',
        ...a,
      ],
      { cwd: dir, encoding: 'utf8' },
    );
    if (r.status !== 0) throw new Error(r.stderr);
  };
  git('init', '-q');
  writeFileSync(join(dir, 'base.txt'), 'x');
  git('add', '.');
  git('commit', '-q', '-m', 'base');
  for (const f of files) {
    mkdirSync(dirname(join(dir, f)), { recursive: true });
    writeFileSync(join(dir, f), 'changed');
  }
  if (!files.length) writeFileSync(join(dir, 'base.txt'), 'x');
  git('add', '.');
  git('commit', '-q', '--allow-empty', '-m', 'pr');
  const out = join(dir, 'out.txt');
  const r = spawnSync('node', [SCRIPT, ...args], {
    cwd: dir,
    encoding: 'utf8',
    env: { ...process.env, GITHUB_EVENT_NAME: event, GITHUB_OUTPUT: out },
  });
  expect(r.status).toBe(0);
  return readFileSync(out, 'utf8').trim();
}

describe('ci-docs-only.mjs', () => {
  it('только документы — лёгкий круг', () => {
    expect(
      docsOnly([
        'docs/BACKLOG.md',
        'README.md',
        '.claude/rules/docs.md',
        'docs/open/x.md',
      ]),
    ).toBe('docs_only=true');
  });
  it.each([
    ['код рядом с документом', ['docs/BACKLOG.md', 'src/app.ts']],
    ['ci.yml', ['docs/BACKLOG.md', '.github/workflows/ci.yml']],
    ['скрипт гейта', ['scripts/check-owner-waiting.mjs']],
    ['док, который читает тест', ['docs/RUNBOOKS.md']],
    ['док, который читает vitest сайта', ['docs/design/REDESIGN_2026-10.md']],
    ['.md вне корня и docs', ['webapp/src/notes.md']],
    ['пустой дифф', []],
  ])('%s — полный круг', (_n, files) => {
    expect(docsOnly(files)).toBe('docs_only=false');
  });
  it('не pull_request — полный круг', () => {
    expect(docsOnly(['docs/BACKLOG.md'], 'push')).toBe('docs_only=false');
  });
});

describe('ci-docs-only.mjs --skip-guide-content', () => {
  const lane = (files: string[]) =>
    docsOnly(files, 'pull_request', ['--skip-guide-content']);
  const CONTENT = [
    'shared/src/schemaTherapy/guide/modes/child.ts',
    'shared/src/schemaTherapy/kb/catalog.ts',
    'scripts/file-size-baseline.json',
    'docs/BACKLOG.md',
  ];

  it('контент справочника с бейслайнами и документом — джоба пропускает шаги', () => {
    expect(lane(CONTENT)).toBe('docs_only=true');
  });
  it('тот же дифф без флага — полный круг: остальные джобы контент проверяют', () => {
    expect(docsOnly(CONTENT)).toBe('docs_only=false');
  });
  it.each([
    [
      'компонент сайта рядом с контентом',
      [...CONTENT, 'webapp/src/components/art/guideSignsModel.ts'],
    ],
    ['иной код shared', ['shared/src/schemaTherapy/content/emotions.ts']],
    ['бэкенд', [...CONTENT, 'src/therapy/kb-ids.ts']],
    ['чужой бейслайн', ['scripts/raw-sql-live-baseline.json']],
  ])('%s — полный круг', (_n, files) => {
    expect(lane(files)).toBe('docs_only=false');
  });
});

const GUIDE_SKIP = ['migrations', 'perf', 'webapp-tz'];

const JOBS = [
  'backend',
  'docker',
  'migrations',
  'perf',
  'webapp',
  'webapp-tz',
  'shared',
  'eslint',
  'browser-smoke',
  'mutation-changed',
];

describe('ci.yml: тяжёлые джобы пропускают шаги, не джобу', () => {
  const blocks = jobBlocks(
    readFileSync(join(process.cwd(), '.github/workflows/ci.yml'), 'utf8'),
  );

  it.each(JOBS)('%s: шаг scope и охрана каждого шага после него', (job) => {
    const body = blocks[job];
    expect(body).toBeDefined();
    expect(body).toContain('node scripts/ci-docs-only.mjs');
    expect(body).not.toMatch(/^ {4}if:.*docs_only/m); // условие на джобу — нет
    const steps = body.split(/^ {6}- /m).slice(1);
    const scopeAt = steps.findIndex((s) => s.includes('ci-docs-only.mjs'));
    expect(scopeAt).toBeGreaterThanOrEqual(0);
    for (const s of steps.slice(scopeAt + 1)) {
      if (s.includes('setup-node')) continue; // node 22 нужен шагам npm audit
      if (s.includes('npm-audit.mjs')) continue; // гейт lockfile-audit: аудит с `if:` не засчитывается
      expect(s).toMatch(/steps\.scope\.outputs\.docs_only (!|=)= 'true'/);
    }
  });

  it.each(JOBS)(
    '%s: контент справочника пропускают только Postgres и вторая зона',
    (job) => {
      expect(blocks[job].includes('--skip-guide-content')).toBe(
        GUIDE_SKIP.includes(job),
      );
    },
  );

  it('джоба checks (гейты над документами) остаётся полной', () => {
    expect(blocks.checks).not.toContain('docs_only');
  });
});
