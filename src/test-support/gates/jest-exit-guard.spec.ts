// Сторож прогона jest в nightly (scripts/jest-exit-guard.mjs) и его место в
// nightly.yml.
//
// Инцидент 2026-10-15 (ci-alarm #672): шаг `npx jest --detectOpenHandles
// --forceExit=false 2>&1 | tail -50` висел 27 минут до отмены джобы — процесс
// держал поллинг, поднятый после stop(), а `tail` не печатал ничего до выхода.
// Шаги run1..3 видели ту же утечку («worker failed to exit gracefully») и
// были зелёными. Сторож превращает оба случая в красный шаг с причиной.
//
// Скрипт исполняется как в CI (песочница gate-sandbox), команды — настоящие
// процессы node, которые печатают то же, что jest, и ведут себя как утечка.
import { runGate } from './gate-sandbox';
import { readFileSync } from 'fs';
import { join } from 'path';

const SCRIPT = 'jest-exit-guard.mjs';
const NODE = process.execPath;
const DONE = "console.error('Ran all test suites.');";

function guard(args: string[], code: string) {
  const started = Date.now();
  const r = runGate(SCRIPT, {}, { args: [...args, '--', NODE, '-e', code] });
  return { ...r, secs: (Date.now() - started) / 1000 };
}

const errors = (stdout: string) =>
  stdout.split('\n').filter((l) => l.startsWith('::error'));

/** Жив ли процесс. Зомби (убит, но ещё не прибран init) — не жив. */
function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
  } catch {
    return false;
  }
  try {
    return !/^\d+ \(.*\) Z /.test(readFileSync(`/proc/${pid}/stat`, 'utf8'));
  } catch {
    return true;
  }
}

describe('jest-exit-guard.mjs', () => {
  it('чистый прогон: код 0, вывод команды проходит в лог, ошибок нет', () => {
    const r = guard([], `console.log('PASS src/a.spec.ts'); ${DONE}`);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('PASS src/a.spec.ts');
    expect(r.stderr).toContain('Ran all test suites.');
    expect(errors(r.stdout)).toEqual([]);
  });

  it('упавшие тесты: код команды пробрасывается, утечкой это не названо', () => {
    const r = guard([], `${DONE} process.exit(3);`);
    expect(r.status).toBe(3);
    expect(errors(r.stdout)).toEqual([]);
  });

  it.each([
    [
      'A worker process has failed to exit gracefully and has been force exited...',
      'failed to exit gracefully',
    ],
    [
      'Jest has detected the following 1 open handle potentially keeping Jest from exiting:',
      'открытые хендлы',
    ],
    [
      'Jest did not exit one second after the test run has completed.',
      'Jest did not exit',
    ],
  ])(
    'признак утечки «%s» роняет шаг при нулевом коде jest',
    (line, verdict) => {
      const r = guard([], `console.error(${JSON.stringify(line)}); ${DONE}`);
      expect(r.status).toBe(1);
      expect(errors(r.stdout).join('\n')).toContain(verdict);
    },
  );

  it('процесс не вышел после итоговой строки: убит через --exit-grace, шаг красный', () => {
    const r = guard(
      ['--exit-grace', '1'],
      `${DONE} setInterval(() => {}, 1000);`,
    );
    expect(r.status).toBe(1);
    expect(errors(r.stdout).join('\n')).toContain('не вышел за 1 с');
    expect(r.secs).toBeLessThan(10);
  });

  it('тесты не закончились за бюджет: убит, причина — завис тест, а не утечка после', () => {
    const r = guard(['--budget', '1'], 'setInterval(() => {}, 1000);');
    expect(r.status).toBe(1);
    const text = errors(r.stdout).join('\n');
    expect(text).toContain('не закончились за 1 с');
    expect(text).not.toContain('не вышел');
    expect(r.secs).toBeLessThan(10);
  });

  it('убивает всю группу: потомок команды не переживает сторожа', () => {
    const code = [
      "const c = require('child_process').spawn('sleep', ['30'], { stdio: 'inherit' });",
      "console.log('CHILD=' + c.pid);",
      DONE,
      'setInterval(() => {}, 1000);',
    ].join(' ');
    const r = guard(['--exit-grace', '1'], code);
    expect(r.status).toBe(1);
    const pid = Number(/CHILD=(\d+)/.exec(r.stdout)?.[1]);
    expect(pid).toBeGreaterThan(0);
    expect(alive(pid)).toBe(false);
    expect(r.secs).toBeLessThan(10);
  });

  it('потомок вне группы держит вывод после выхода jest — тоже утечка, сторож не виснет', () => {
    const code = [
      "require('child_process').spawn('sleep', ['5'], { stdio: 'inherit', detached: true }).unref();",
      DONE,
    ].join(' ');
    const r = guard([], code);
    expect(r.status).toBe(1);
    expect(errors(r.stdout).join('\n')).toContain('пережил его');
    expect(r.secs).toBeLessThan(5);
  });

  it.each([
    [['--budget', 'x', '--', 'true']],
    [['--exit-grace', '0', '--', 'true']],
    [['--what', '1', '--', 'true']],
    [['--budget', '5']],
  ])('неверные аргументы %j: код 2, команда не запускается', (args) => {
    const r = runGate(SCRIPT, {}, { args });
    expect(r.status).toBe(2);
  });
});

// ── nightly.yml: каждый jest джобы backend-flaky — через сторожа ───────────
// YAML-парсера в зависимостях нет: шаги режутся по отступу, как в
// alarm-workflow.spec.ts.
const NIGHTLY = readFileSync(
  join(process.cwd(), '.github', 'workflows', 'nightly.yml'),
  'utf8',
);

function job(yml: string, name: string): string {
  const start = yml.search(new RegExp(`^ {2}${name}:\\n`, 'm'));
  if (start < 0) throw new Error(`джобы ${name} нет`);
  const rest = yml.slice(start + 1);
  const next = rest.search(/^ {2}\S/m);
  return next < 0 ? rest : rest.slice(0, next);
}

/** Значение ключа шага: первая строка шага идёт сразу после «- ». */
const stepField = (step: string, key: string) =>
  new RegExp(`^(?: {8})?${key}: (.*)$`, 'm').exec(step)?.[1];

describe('nightly.yml, backend-flaky: jest не может молча висеть', () => {
  const flaky = job(NIGHTLY, 'backend-flaky');
  const steps = flaky.split(/^ {6}- /m).slice(1);
  const run = (s: string) => stepField(s, 'run') ?? '';
  const jestSteps = steps.filter((s) => /\bjest\b/.test(run(s)));
  const minutes = (s: string) => Number(stepField(s, 'timeout-minutes'));

  it('шагов с jest четыре: три прогона и detectOpenHandles', () => {
    expect(jestSteps).toHaveLength(4);
    expect(jestSteps.some((s) => /--detectOpenHandles/.test(s))).toBe(true);
  });

  it.each([0, 1, 2, 3])(
    'шаг %i: через jest-exit-guard, без пайпа и без --forceExit',
    (i) => {
      const cmd = run(jestSteps[i]);
      expect(cmd).toMatch(
        /^node scripts\/jest-exit-guard\.mjs .* -- npx jest\b/,
      );
      expect(cmd).not.toMatch(/\|/);
      expect(cmd).not.toMatch(/--forceExit/);
    },
  );

  it.each([0, 1, 2, 3])(
    'шаг %i: бюджет + ожидание выхода + минута запаса ≤ timeout-minutes шага',
    (i) => {
      const cmd = run(jestSteps[i]);
      const budget = Number(/--budget (\d+)/.exec(cmd)?.[1]);
      const grace = Number(/--exit-grace (\d+)/.exec(cmd)?.[1]);
      expect(budget).toBeGreaterThan(0);
      expect(grace).toBeGreaterThan(0);
      expect(budget + grace + 60).toBeLessThanOrEqual(
        minutes(jestSteps[i]) * 60,
      );
    },
  );

  it('сумма timeout-minutes шагов + 2 минуты установки ≤ timeout-minutes джобы', () => {
    const sum = jestSteps.reduce((acc, s) => acc + minutes(s), 0);
    const jobMinutes = Number(/^ {4}timeout-minutes: (\d+)$/m.exec(flaky)?.[1]);
    expect(sum + 2).toBeLessThanOrEqual(jobMinutes);
  });
});
