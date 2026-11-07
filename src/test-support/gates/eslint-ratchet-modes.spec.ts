// Режимы запуска eslint-храповика (scripts/check-eslint-ratchet.mjs).
//
// Полный прогон `eslint .` держал в памяти программы TypeScript всех четырёх
// пакетов и падал с OOM у лимита кучи ~2 ГБ в контейнере агента (находка
// PR #880). Лечение — нарезка на дочерние процессы по каталогам верхнего
// уровня с суммированием отчётов, плюс локальный `--changed` по файлам,
// отличающимся от origin/main. Обе половины — свежий код с ветвлением, и
// сломаться они могут молча: пропущенный шард или не попавший в список
// изменённый файл дают «✓» на пустоте. Поэтому сам eslint подменяется швом
// RATCHET_ESLINT_BIN на поддельный бинарь, который записывает, что ему
// передали, и отвечает заранее известным отчётом, — а проверяется ровно та
// логика нарезки, сбора и вердикта, что работает в CI. Сравнение отчёта с
// бейслайном покрыто соседним eslint-jscpd-ratchet.spec.ts.
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';
import { runGate, cleanupTmp } from './gate-sandbox';

const GATE = 'check-eslint-ratchet.mjs';
// Модуль правил, который движок тянет через `from './…'`: песочница обязана
// скопировать его вместе с гейтом, иначе прогон падал бы ERR_MODULE_NOT_FOUND.
const RULES_MODULE = 'eslint-ratchet-rules.mjs';
const BASELINE = 'scripts/eslint-baseline.json';

/** Поддельный eslint: цели — всё до `--format`; пишет их строкой в calls.log,
 * на каждую цель из FAKE_HITS отдаёт одно нарушение, при FAKE_BROKEN_FOR в
 * целях — ломается без JSON (имитация OOM/сбоя конфига). */
const FAKE_ESLINT = `
import { appendFileSync } from 'fs';
const args = process.argv.slice(2);
const targets = args.slice(0, args.indexOf('--format'));
appendFileSync('calls.log', targets.join(' ') + '\\n');
if (targets.includes(process.env.FAKE_BROKEN_FOR ?? '\\0')) {
  process.stderr.write('FATAL ERROR: heap out of memory');
  process.exit(2);
}
const hits = (process.env.FAKE_HITS ?? '').split(',').filter(Boolean);
const report = targets
  .filter((t) => hits.includes(t))
  .map((t) => ({
    filePath: '/repo/' + t,
    errorCount: 1,
    warningCount: 0,
    messages: [{ ruleId: 'no-explicit-any', line: 1, message: 'any' }],
  }));
console.log(JSON.stringify(report));
`;

const baseline = (total: number) =>
  JSON.stringify({
    total,
    errors: total,
    warnings: 0,
    byRule: total ? { 'no-explicit-any': total } : {},
  });

const fakeEnv = (extra: Record<string, string> = {}) =>
  ({
    ...process.env,
    RATCHET_ESLINT_BIN: 'fake-eslint.mjs',
    ...extra,
  }) as Record<string, string>;

const tree = {
  'fake-eslint.mjs': FAKE_ESLINT,
  'src/a.ts': 'export const a = 1;\n',
  'webapp/src/b.tsx': 'export const b = 2;\n',
  'node_modules/dep/index.js': 'module.exports = 1;\n',
  'game/legacy.ts': 'const x: any = 1;\n',
  '.claude/notes.md': '# заметки\n',
  'README.md': '# корень\n',
};

const callsOf = (tmp: string) =>
  readFileSync(join(tmp, 'calls.log'), 'utf8').trim().split('\n');

describe('гейт: eslint-храповик, полный режим — нарезка по каталогам', () => {
  it('каждый каталог верхнего уровня линтуется отдельным запуском, счётчики складываются', () => {
    const res = runGate(
      GATE,
      { ...tree, [BASELINE]: baseline(1) },
      { env: fakeEnv({ FAKE_HITS: 'src,webapp' }), keepTmp: true },
    );
    try {
      expect(existsSync(join(res.tmp, 'scripts', RULES_MODULE))).toBe(true);
      const calls = callsOf(res.tmp);
      // src и webapp — отдельные процессы; корневые файлы — одним запуском.
      expect(calls).toContain('src');
      expect(calls).toContain('webapp');
      expect(calls.some((c) => c.split(' ').includes('README.md'))).toBe(true);
      // Замороженное и чужое не линтуется; точечные каталоги — тоже.
      expect(calls.join('\n')).not.toMatch(/node_modules|game|\.claude/);
      // Сумма 1 (src) + 1 (webapp) = 2 против бейслайна 1 — рост.
      expect(res.status).toBe(1);
      expect(res.stderr).toContain('1 → 2');
      expect(res.stderr).toContain('/repo/webapp');
    } finally {
      cleanupTmp(res.tmp);
    }
  });

  it('сумма по шардам равна бейслайну — зелёный', () => {
    const res = runGate(
      GATE,
      { ...tree, [BASELINE]: baseline(2) },
      { env: fakeEnv({ FAKE_HITS: 'src,webapp' }) },
    );
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('без роста');
  });

  it('сбой одного шарда (OOM, кривой конфиг) роняет гейт и называет шард', () => {
    const res = runGate(
      GATE,
      { ...tree, [BASELINE]: baseline(0) },
      { env: fakeEnv({ FAKE_BROKEN_FOR: 'webapp' }) },
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('не отработал (webapp)');
    expect(res.stderr).toContain('heap out of memory');
  });
});

/** Песочница с историей: базовый коммит = origin/main, затем правка a.ts,
 * новый неотслеживаемый d.ts и удаление c.ts; b.tsx и README не трогаем. */
const gitHistory = (tmp: string) => {
  const g = (...args: string[]) => {
    const r = spawnSync(
      'git',
      ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args],
      { cwd: tmp, encoding: 'utf8' },
    );
    if (r.status !== 0) throw new Error(r.stderr);
  };
  writeFileSync(join(tmp, 'src/c.ts'), 'export const c = 3;\n');
  g('init', '-q');
  g('add', '-A');
  g('commit', '-q', '-m', 'base');
  g('update-ref', 'refs/remotes/origin/main', 'HEAD');
  writeFileSync(join(tmp, 'src/a.ts'), 'export const a: any = 1;\n');
  writeFileSync(join(tmp, 'src/d.ts'), 'export const d = 4;\n');
  g('rm', '-q', 'src/c.ts');
};

describe('гейт: eslint-храповик, --changed — только файлы против origin/main', () => {
  it('линтует изменённые и новые файлы одним запуском, удалённые и нетронутые — нет', () => {
    const res = runGate(
      GATE,
      { ...tree, [BASELINE]: baseline(0) },
      {
        args: ['--changed'],
        env: fakeEnv({ FAKE_HITS: 'src/a.ts' }),
        setup: gitHistory,
        keepTmp: true,
      },
    );
    try {
      const calls = callsOf(res.tmp);
      expect(calls).toHaveLength(1);
      const targets = calls[0].split(' ');
      expect(targets).toEqual(expect.arrayContaining(['src/a.ts', 'src/d.ts']));
      expect(targets).not.toContain('src/c.ts');
      expect(targets).not.toContain('webapp/src/b.tsx');
      expect(targets).not.toContain('README.md');
      // Находка в изменённом файле — красное, даже при нулевом бейслайне.
      expect(res.status).toBe(1);
      expect(res.stderr).toContain('--changed');
      expect(res.stderr).toContain('/repo/src/a.ts');
    } finally {
      cleanupTmp(res.tmp);
    }
  });

  it('изменённые файлы чисты — зелёный', () => {
    const res = runGate(
      GATE,
      { ...tree, [BASELINE]: baseline(0) },
      { args: ['--changed'], env: fakeEnv(), setup: gitHistory },
    );
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('находок нет');
  });

  it('нет отличий от origin/main — зелёный без запуска eslint', () => {
    const res = runGate(
      GATE,
      { ...tree, [BASELINE]: baseline(0) },
      {
        args: ['--changed'],
        env: fakeEnv({ FAKE_HITS: 'src/a.ts' }),
        setup: (tmp) => {
          gitHistory(tmp);
          spawnSync('git', ['checkout', '-q', '--', 'src'], { cwd: tmp });
          spawnSync('git', ['clean', '-qfd', 'src'], { cwd: tmp });
        },
      },
    );
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('изменённых файлов нет');
  });

  it('--changed --update отказывается трогать бейслайн', () => {
    const res = runGate(
      GATE,
      { ...tree, [BASELINE]: baseline(0) },
      {
        args: ['--changed', '--update'],
        env: fakeEnv(),
        setup: gitHistory,
        keepTmp: true,
      },
    );
    try {
      expect(res.status).toBe(1);
      expect(readFileSync(join(res.tmp, BASELINE), 'utf8')).toBe(baseline(0));
    } finally {
      cleanupTmp(res.tmp);
    }
  });
});
