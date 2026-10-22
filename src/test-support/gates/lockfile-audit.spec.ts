// Гейт «у каждого lock-файла есть шаг npm audit» (аудит 2026-10). До него
// audit стоял один — на корень, ci.yml; lock-файлы webapp, мини-аппа, shared
// и игры не проверял никто, а Dependabot (dependabot-coverage.spec.ts) только
// предлагает обновления, мерж не блокирует. Правила — lockfile-audit.ts;
// здесь оба исхода на образцах, прогон по настоящему ci.yml и ИСПОЛНЕНИЕ
// ночного шага из nightly.yml с подменённым npm (шов — сам скрипт воркфлоу,
// не его пересказ, как в alarm-workflow.spec.ts).
import { execFileSync, spawnSync } from 'child_process';
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { lockDirectory } from './dependabot-coverage';
import {
  auditCoverage,
  auditedDirectories,
  isGatingAudit,
  prefixDirectory,
} from './lockfile-audit';
import { jobBlocks } from './workflow-yaml';

const ROOT = process.cwd();
const read = (f: string) =>
  readFileSync(join(ROOT, '.github', 'workflows', f), 'utf8');
const locks = execFileSync('git', ['ls-files', '*package-lock.json'], {
  cwd: ROOT,
  encoding: 'utf8',
})
  .split('\n')
  .filter(Boolean);

const AUDIT = 'npm audit --omit=dev --audit-level=high';
const job = (id: string, ...steps: string[]) =>
  `  ${id}:\n    runs-on: ubuntu-latest\n    timeout-minutes: 5\n    steps:\n      - uses: actions/checkout@v7\n${steps.join('')}`;
const run = (cmd: string, extra = '') =>
  `      - name: audit\n        timeout-minutes: 3\n${extra}        run: ${cmd}\n`;
const ci = (...jobs: string[]) =>
  `name: CI\n\non:\n  push:\n\njobs:\n${jobs.join('\n')}`;
const LOCKS = [
  'package-lock.json',
  'shared/package-lock.json',
  'webapp/package-lock.json',
];

describe('гейт: у каждого lock-файла есть npm audit в CI', () => {
  describe('образцы', () => {
    it('нет шага для shared — краснеет как missing', () => {
      const text = ci(
        job('backend', run(AUDIT)),
        job('webapp', run(`${AUDIT} --prefix webapp`)),
      );
      expect(auditCoverage(text, LOCKS)).toEqual({
        missing: ['/shared'],
        stale: [],
      });
    });

    it('тот же CI с шагом для shared — зелёный; корень без prefix — «/»', () => {
      const text = ci(
        job('backend', run(AUDIT)),
        job('webapp', run(`${AUDIT} --prefix webapp`)),
        job('shared', run(`${AUDIT} --prefix shared`)),
      );
      expect(auditCoverage(text, LOCKS)).toEqual({ missing: [], stale: [] });
    });

    it('шаг для каталога без lock-файла — stale', () => {
      const text = ci(
        job(
          'backend',
          run(AUDIT),
          run(`${AUDIT} --prefix shared`),
          run(`${AUDIT} --prefix webapp`),
          run(`${AUDIT} --prefix foo`),
        ),
      );
      expect(auditCoverage(text, LOCKS)).toEqual({
        missing: [],
        stale: ['/foo'],
      });
    });

    it('каталог из --prefix: пробел и =, ./ и хвостовой слэш, «.» — корень', () => {
      expect(prefixDirectory(`${AUDIT} --prefix webapp`)).toBe('/webapp');
      expect(prefixDirectory(`${AUDIT} --prefix=./shared/`)).toBe('/shared');
      expect(prefixDirectory(`${AUDIT} --prefix "game"`)).toBe('/game');
      expect(prefixDirectory(`${AUDIT} --prefix .`)).toBe('/');
      expect(prefixDirectory(AUDIT)).toBe('/');
    });

    it('строже high засчитывается: без --omit=dev и без --audit-level', () => {
      expect(isGatingAudit('run: npm audit --audit-level=moderate')).toBe(true);
      expect(isGatingAudit('run: npm audit --omit=dev')).toBe(true);
    });

    // Контрольные образцы (правило №15 п.2): шаг есть, но исход заглушен —
    // такой шаг не закрывает каталог.
    it.each([
      [
        'уровень critical — high проходит',
        `${AUDIT.replace('high', 'critical')}`,
        '',
      ],
      ['уровень none', `${AUDIT.replace('high', 'none')}`, ''],
      ['|| true', `${AUDIT} || true`, ''],
      ['|| :', `${AUDIT} || :`, ''],
      ['continue-on-error: true', AUDIT, '        continue-on-error: true\n'],
      ['if: у шага', AUDIT, '        if: false\n'],
      ['npm audit fix — не проверка', 'npm audit fix', ''],
    ])('не засчитывается: %s', (_n, cmd, extra) => {
      const text = ci(job('backend', run(cmd, extra)));
      expect(auditedDirectories(text)).toEqual([]);
    });

    it('не засчитывается: шаг в джобе с if: или continue-on-error', () => {
      const guarded = (key: string) =>
        ci(
          job('b', run(AUDIT)).replace('    steps:', `    ${key}\n    steps:`),
        );
      expect(auditedDirectories(guarded('if: false'))).toEqual([]);
      expect(auditedDirectories(guarded('continue-on-error: true'))).toEqual(
        [],
      );
      // Контроль: тот же сэмпл без ключа засчитан.
      expect(auditedDirectories(ci(job('b', run(AUDIT))))).toEqual(['/']);
    });

    it('закомментированный шаг не засчитывается', () => {
      const text = ci(job('backend', `      # - run: ${AUDIT}\n`));
      expect(auditedDirectories(text)).toEqual([]);
    });
  });

  describe('настоящий ci.yml', () => {
    it('lock-файлов не меньше пяти (иначе проверка пуста)', () => {
      expect(locks.length).toBeGreaterThanOrEqual(5);
    });

    it('у каждого lock-файла есть засчитанный шаг, лишних нет', () => {
      expect(auditCoverage(read('ci.yml'), locks)).toEqual({
        missing: [],
        stale: [],
      });
    });
  });
});

/** Тело `run: |` шага (отступ 10) по имени шага в джобе. */
function runBlock(jobText: string, name: string): string {
  const step = jobText
    .split(/^ {6}- /m)
    .find((s) => s.startsWith(`name: ${name}`));
  if (!step) throw new Error(`шага «${name}» нет`);
  const lines = step.split('\n');
  const at = lines.findIndex((l) => /^ {8}run: \|\s*$/.test(l));
  const body: string[] = [];
  for (const l of lines.slice(at + 1)) {
    if (l.trim() !== '' && !l.startsWith(' '.repeat(10))) break;
    body.push(l.slice(10));
  }
  return body.join('\n');
}

describe('nightly.yml: ночной npm audit всех lock-файлов', () => {
  const nightly = jobBlocks(read('nightly.yml'))['npm-audit'];
  let bin: string;
  let log: string;

  beforeAll(() => {
    bin = mkdtempSync(join(tmpdir(), 'fake-npm-'));
    log = join(bin, 'npm.log');
    // Подменённый npm: пишет аргументы, валит каталог из FAIL_DIR.
    writeFileSync(
      join(bin, 'npm'),
      '#!/bin/sh\necho "npm $*" >> "$NPM_LOG"\ncase " $* " in *" --prefix $FAIL_DIR "*) exit 1;; esac\n',
    );
    chmodSync(join(bin, 'npm'), 0o755);
  });
  afterAll(() => rmSync(bin, { recursive: true, force: true }));

  function exec(cwd: string, failDir = '') {
    if (existsSync(log)) rmSync(log);
    const r = spawnSync(
      'bash',
      ['-e', '-c', runBlock(nightly, 'npm audit по каждому package-lock.json')],
      {
        cwd,
        env: {
          PATH: `${bin}:${process.env.PATH}`,
          NPM_LOG: log,
          FAIL_DIR: failDir,
        },
        encoding: 'utf8',
      },
    );
    const calls = existsSync(log)
      ? readFileSync(log, 'utf8').split('\n').filter(Boolean)
      : [];
    return { status: r.status, out: `${r.stdout}${r.stderr}`, calls };
  }

  it('джоба есть, с таймаутом шага', () => {
    expect(nightly).toBeDefined();
    expect(nightly).toMatch(/^ {8}timeout-minutes: \d+$/m);
  });

  it('чистые пакеты: код 0, audit по разу на каждый lock-файл', () => {
    const r = exec(ROOT);
    expect(r.status).toBe(0);
    expect(r.calls.map(prefixDirectory).sort()).toEqual(
      locks.map(lockDirectory).sort(),
    );
    expect(r.calls.every(isGatingAudit)).toBe(true);
  });

  it('уязвимость в одном пакете: красный, ::error:: с его именем, остальные всё равно проверены', () => {
    const r = exec(ROOT, 'webapp');
    expect(r.status).not.toBe(0);
    expect(r.out).toMatch(/::error::.*webapp/);
    expect(r.calls).toHaveLength(locks.length);
  });

  it('lock-файлов нет: красный, а не «проверено ничего»', () => {
    const empty = mkdtempSync(join(tmpdir(), 'no-locks-'));
    try {
      execFileSync('git', ['init', '-q'], { cwd: empty });
      const r = exec(empty);
      expect(r.status).not.toBe(0);
      expect(r.out).toContain('::error::');
      expect(r.calls).toEqual([]);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });
});
