// Гейт «у каждого lock-файла есть шаг npm audit» (аудит 2026-10). До него
// audit стоял один — на корень, ci.yml; lock-файлы webapp, мини-аппа, shared
// и игры не проверял никто, а Dependabot (dependabot-coverage.spec.ts) только
// предлагает обновления, мерж не блокирует. Правила — lockfile-audit.ts;
// здесь оба исхода на образцах, прогон по настоящему ci.yml и ИСПОЛНЕНИЕ
// ночного шага из nightly.yml с подменённым npm (шов — сам скрипт воркфлоу,
// не его пересказ, как в alarm-workflow.spec.ts). Шаги зовут обёртку
// scripts/npm-audit.mjs (регресс #814); её флаги пинит npm-audit.spec.ts.
import { execFileSync, spawnSync } from 'child_process';
import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { lockDirectory } from './dependabot-coverage';
import { makeFakeNpm, type FakeNpm } from './fake-npm';
import {
  auditCoverage,
  auditedDirectories,
  isGatingAudit,
  prefixDirectory,
  rawAuditLines,
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
const WRAP = 'node scripts/npm-audit.mjs';
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
      ['|| exit 0', `${AUDIT} || exit 0`, ''],
      ['; exit 0', `${AUDIT}; exit 0`, ''],
      ['true || — не исполняется', `true || ${AUDIT}`, ''],
      ['только аргумент echo', `echo ${AUDIT}`, ''],
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

    it('обёртка засчитана, каталог — её аргумент; «.» — корень', () => {
      const text = ci(
        job('backend', run(`${WRAP} .`), run(`${WRAP} shared`)),
        job('webapp', run(`${WRAP} webapp`)),
      );
      expect(auditCoverage(text, LOCKS)).toEqual({ missing: [], stale: [] });
      expect(prefixDirectory(`${WRAP} "game"`)).toBe('/game');
      expect(prefixDirectory(WRAP)).toBe('/');
      expect(prefixDirectory(`${WRAP} || true`)).toBe('/');
    });

    // Контроль к обёртке: глушащие формы те же, что у голого npm audit.
    // Код 2 («реестр не ответил») и 3 («npm не может проверить») — красные:
    // `|| [ $? -eq 2 ]` сделал бы непроверенное зелёным (ревью #814).
    it.each([
      ['|| true', `${WRAP} webapp || true`, ''],
      ['|| [ $? -eq 2 ]', `${WRAP} webapp || [ $? -eq 2 ]`, ''],
      ['|| exit 0', `${WRAP} webapp || exit 0`, ''],
      ['; exit 0', `${WRAP} webapp; exit 0`, ''],
      ['& в фон', `${WRAP} webapp &`, ''],
      ['| в конвейер', `${WRAP} webapp | tee audit.log`, ''],
      ['только аргумент echo', `echo ${WRAP} webapp`, ''],
      ['другой файл: .mjs.bak', `node scripts/npm-audit.mjs.bak webapp`, ''],
      [
        'закомментирован в run: |',
        `|\n          # cd . && ${WRAP} webapp\n          echo skipped`,
        '',
      ],
      [
        'continue-on-error: true',
        `${WRAP} webapp`,
        '        continue-on-error: true\n',
      ],
      ['if: у шага', `${WRAP} webapp`, '        if: false\n'],
      ['«npm audit» только в имени шага', 'echo skipped', ''],
    ])('обёртка не засчитывается: %s', (_n, cmd, extra) => {
      const step = run(cmd, extra).replace(
        'name: audit',
        'name: npm audit — x',
      );
      expect(auditedDirectories(ci(job('webapp', step)))).toEqual([]);
    });

    // Контроль к форме выше: перед вызовом `&&`/`;` и многострочный run —
    // законны, вызов остаётся исходом строки.
    it.each([
      ['echo && обёртка', `echo start && ${WRAP} webapp`],
      ['cd; обёртка', `cd . ; ${WRAP} webapp`],
      [
        'run: | с комментарием',
        `|\n          # проверка\n          ${WRAP} webapp`,
      ],
    ])('обёртка засчитывается: %s', (_n, cmd) => {
      expect(auditedDirectories(ci(job('webapp', run(cmd))))).toEqual([
        '/webapp',
      ]);
    });

    it('голый npm audit в run находится, и после echo &&; имя шага, аргумент echo и комментарий — нет', () => {
      const text = ci(
        job(
          'b',
          run(AUDIT),
          run(`echo start && ${AUDIT} --prefix webapp`),
          run(`${WRAP} .`).replace('name: audit', 'name: npm audit — корень'),
          `      # npm audit читает lock-файл\n`,
          `      # cd webapp && ${AUDIT}\n`,
          run('echo "::group::npm audit $dir"'),
        ),
      );
      expect(rawAuditLines(text)).toEqual([AUDIT, `${AUDIT} --prefix webapp`]);
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

    // Голый audit без внешнего таймера висел на реестре до таймаута шага
    // и красил main без уязвимости (регресс #814).
    it.each(['ci.yml', 'nightly.yml'])(
      '%s: npm audit только через обёртку',
      (f) => {
        expect(rawAuditLines(read(f))).toEqual([]);
      },
    );
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
  let npm: FakeNpm;

  beforeAll(() => {
    npm = makeFakeNpm();
  });
  afterAll(() => npm.cleanup());

  // Настоящий шаг → настоящая обёртка → поддельный npm с записанными
  // ответами реестра (правила ответов — fake-npm.ts).
  function exec(cwd: string, rules = '*=clean') {
    npm.reset();
    const r = spawnSync(
      'bash',
      ['-e', '-c', runBlock(nightly, 'npm audit по каждому package-lock.json')],
      {
        cwd,
        env: npm.env(rules, {
          NPM_AUDIT_ATTEMPTS: '2',
          NPM_AUDIT_PAUSE_MS: '20',
        }),
        encoding: 'utf8',
      },
    );
    return {
      status: r.status,
      out: `${r.stdout}${r.stderr}`,
      calls: npm.calls(),
    };
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
    const r = exec(ROOT, 'webapp=high;*=clean');
    expect(r.status).not.toBe(0);
    expect(r.out).toContain(
      '::error::npm audit: high/critical в prod-зависимостях: webapp',
    );
    expect(r.out).not.toContain('реестр npm не ответил для');
    expect(r.calls).toHaveLength(locks.length);
  });

  it('реестр не ответил по одному пакету: красный отдельным ::error::, не «уязвимость»', () => {
    const r = exec(ROOT, 'game=registry-400;*=clean');
    expect(r.status).not.toBe(0);
    expect(r.out).toContain(
      '::error::npm audit: реестр npm не ответил для: game',
    );
    expect(r.out).not.toContain('high/critical в prod-зависимостях:');
    // game — две попытки, остальные — по одной.
    expect(r.calls).toHaveLength(locks.length + 1);
  });

  it('npm не может проверить один пакет (ENOLOCK): красный своим ::error::, без повторов', () => {
    const r = exec(ROOT, 'shared=enolock;*=clean');
    expect(r.status).not.toBe(0);
    expect(r.out).toContain(
      '::error::npm audit: npm не смог проверить: shared',
    );
    expect(r.out).not.toContain('high/critical в prod-зависимостях:');
    expect(r.out).not.toContain('реестр npm не ответил для');
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
