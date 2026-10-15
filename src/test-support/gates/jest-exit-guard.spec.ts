// Сторож прогона jest в nightly (scripts/jest-exit-guard.mjs + правила в
// jest-exit-guard-rules.mjs). Место в nightly.yml пинит nightly-jest-steps.spec.ts.
//
// Инцидент 2026-10-15 (ci-alarm #672): шаг `npx jest --detectOpenHandles
// --forceExit=false 2>&1 | tail -50` висел 27 минут до отмены джобы — процесс
// держал поллинг, поднятый после stop(), а `tail` не печатал ничего до выхода.
// Шаги run1..3 видели ту же утечку («worker failed to exit gracefully») и
// были зелёными. Сторож превращает оба случая в красный шаг с причиной.
//
// Вывод jest здесь не сочинён, а ЗАПИСАН (правило №23):
// test/fixtures/recorded/jest-run-output.json — оба режима nightly (воркеры с
// --silent и один процесс с --detectOpenHandles). Первая версия сторожа ждала
// «Ran all test suites», а с --silent jest эту строку не печатает — фикстура,
// написанная по памяти, этого бы не показала. Двойник jest — настоящий
// процесс node: печатает записанное в stderr (туда его пишет jest) и ведёт
// себя по сценарию (выходит с кодом, виснет, плодит потомков).
import { spawn, spawnSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';
import { REAL_SCRIPTS_DIR } from './gate-sandbox';
import { loadRecordedFixture } from '../recorded-fixture';
import { callExport } from './pattern-loader';

const SCRIPT = join(REAL_SCRIPTS_DIR, 'jest-exit-guard.mjs');
const NODE = process.execPath;
const HANG = 'setInterval(() => {}, 1000);';
const REC = JSON.parse(loadRecordedFixture('jest-run-output.json')) as Record<
  | 'silentWorkersClean'
  | 'silentWorkersLeak'
  | 'inBandClean'
  | 'inBandFailed'
  | 'openHandlesDetected'
  | 'didNotExit',
  string
>;

/** Код двойника jest: записанный вывод в stderr, потом сценарий. */
const fakeJest = (sample: string, then = '') =>
  `process.stderr.write(${JSON.stringify(sample)}); ${then}`;

// Сторож ничего не читает от корня репозитория, песочница gate-sandbox ему не
// нужна: вызов как в nightly.yml, `node scripts/jest-exit-guard.mjs …`. Потолок
// на прогон — чтобы сломанный, зависающий сторож не повесил джобу backend.
function runGuard(args: string[]) {
  const started = Date.now();
  const r = spawnSync(NODE, [SCRIPT, ...args], {
    encoding: 'utf8',
    timeout: 30_000,
    killSignal: 'SIGKILL',
  });
  return { ...r, secs: (Date.now() - started) / 1000 };
}

const guard = (args: string[], code: string) =>
  runGuard([...args, '--', NODE, '-e', code]);

const errors = (stdout: string) =>
  stdout
    .split('\n')
    .filter((l) => l.startsWith('::error'))
    .join('\n');

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

describe('записанный вывод jest: на чём держится сторож', () => {
  it('с --silent и воркерами строки «Ran all test suites» нет, сводка есть', () => {
    expect(REC.silentWorkersClean).not.toMatch(/Ran all test suites/);
    expect(REC.silentWorkersClean).toMatch(/^Test Suites: .* total$/m);
    expect(REC.inBandClean).toMatch(/^Ran all test suites\.$/m);
  });
});

describe('jest-exit-guard.mjs на записанном выводе', () => {
  it.each(['silentWorkersClean', 'inBandClean'] as const)(
    '%s, код 0: шаг зелёный, вывод проходит в лог',
    (key) => {
      const r = guard([], fakeJest(REC[key]));
      expect(r.status).toBe(0);
      expect(r.stderr).toContain('Test Suites:');
      expect(errors(r.stdout)).toBe('');
    },
  );

  it('упавшие тесты (код 1): код пробрасывается, своих вердиктов нет', () => {
    const r = guard([], fakeJest(REC.inBandFailed, 'process.exit(1);'));
    expect(r.status).toBe(1);
    expect(errors(r.stdout)).toBe('');
  });

  it.each(['silentWorkersClean', 'inBandClean'] as const)(
    '%s, но код 1: «ни один тест не упал» — кто-то выставил process.exitCode',
    (key) => {
      const r = guard([], fakeJest(REC[key], 'process.exitCode = 1;'));
      expect(r.status).toBe(1);
      expect(errors(r.stdout)).toContain('хотя ни один тест не упал');
      expect(errors(r.stdout)).toContain('process.exitCode');
    },
  );

  it.each([
    ['silentWorkersLeak', 'failed to exit gracefully'],
    ['openHandlesDetected', 'открытые хендлы'],
    ['didNotExit', 'Jest did not exit'],
  ] as const)('%s при коде 0 — красный шаг: %s', (key, verdict) => {
    const r = guard([], fakeJest(REC[key]));
    expect(r.status).toBe(1);
    expect(errors(r.stdout)).toContain(verdict);
  });

  it.each(['silentWorkersClean', 'inBandClean'] as const)(
    '%s, процесс не выходит: убит через --exit-grace, вердикт «не вышел», а не бюджет',
    (key) => {
      const r = guard(
        ['--budget', '20', '--exit-grace', '1'],
        fakeJest(REC[key], HANG),
      );
      expect(r.status).toBe(1);
      expect(errors(r.stdout)).toContain('не вышел за 1 с');
      expect(errors(r.stdout)).not.toContain('не закончились');
      expect(r.secs).toBeLessThan(10);
    },
  );

  it('сводки нет — бюджет: «завис тест», а не утечка после', () => {
    const passOnly = REC.inBandClean.split('\n')[0] + '\n';
    const r = guard(['--budget', '1'], fakeJest(passOnly, HANG));
    expect(r.status).toBe(1);
    expect(errors(r.stdout)).toContain('не закончились за 1 с');
    expect(errors(r.stdout)).not.toContain('не вышел');
  });

  it('КОНТРОЛЬ: сводка с отступом (текст упавшего утверждения) — не конец прогона', () => {
    const quoted = REC.inBandClean.replace(/^/gm, '    ');
    const r = guard(
      ['--budget', '2', '--exit-grace', '1'],
      fakeJest(quoted, HANG),
    );
    expect(errors(r.stdout)).toContain('не закончились за 2 с');
    expect(errors(r.stdout)).not.toContain('не вышел');
  });
});

describe('jest-exit-guard.mjs: процессы', () => {
  it('убивает всю группу: потомок команды не переживает сторожа', () => {
    const code = fakeJest(
      REC.inBandClean,
      "const c = require('child_process').spawn('sleep', ['30'], { stdio: 'inherit' });" +
        "console.log('CHILD=' + c.pid);" +
        HANG,
    );
    const r = guard(['--exit-grace', '1'], code);
    expect(r.status).toBe(1);
    const pid = Number(/CHILD=(\d+)/.exec(r.stdout)?.[1]);
    expect(pid).toBeGreaterThan(0);
    expect(alive(pid)).toBe(false);
    expect(r.secs).toBeLessThan(10);
  });

  it('потомок вне группы держит вывод после выхода jest — утечка, сторож не виснет', () => {
    const code = fakeJest(
      REC.inBandClean,
      "require('child_process').spawn('sleep', ['5'], { stdio: 'inherit', detached: true }).unref();",
    );
    const r = guard([], code);
    expect(r.status).toBe(1);
    expect(errors(r.stdout)).toContain('пережил его');
    expect(r.secs).toBeLessThan(5);
  });

  it('SIGTERM сторожу (отмена шага) доходит до jest в его группе', async () => {
    const proc = spawn(NODE, [
      SCRIPT,
      '--',
      NODE,
      '-e',
      "console.log('CHILD=' + process.pid);" + HANG,
    ]);
    let out = '';
    proc.stdout.on('data', (d: Buffer) => (out += d.toString()));
    const exited = new Promise<void>((r) => proc.on('close', () => r()));
    for (let i = 0; i < 200 && !/CHILD=\d+/.test(out); i++) {
      await new Promise((r) => setTimeout(r, 25));
    }
    const pid = Number(/CHILD=(\d+)/.exec(out)?.[1]);
    expect(pid).toBeGreaterThan(0);
    proc.kill('SIGTERM');
    await exited;
    expect(out).toContain('сигнал SIGTERM');
    expect(alive(pid)).toBe(false);
  }, 20_000);

  it.each([
    [['--budget', 'x', '--', 'true']],
    [['--exit-grace', '0', '--', 'true']],
    [['--what', '1', '--', 'true']],
    [['--budget', '5']],
  ])('неверные аргументы %j: код 2, команда не запускается', (args) => {
    expect(runGuard(args).status).toBe(2);
  });
});

// Правила сторожа — отдельный модуль (scripts/jest-exit-guard-rules.mjs):
// конец прогона узнаётся по сводке, привязанной к началу строки, в ОБОИХ
// режимах nightly — на записанном выводе, а не на сочинённой строке.
describe('jest-exit-guard-rules.mjs: runFinished', () => {
  const finished = (text: string) =>
    callExport('jest-exit-guard-rules.mjs', 'runFinished', text) as unknown;
  it.each([
    ['silentWorkersClean'],
    ['silentWorkersLeak'],
    ['inBandClean'],
  ] as const)('%s: сводка найдена — прогон закончен', (key) => {
    expect(finished(REC[key])).toBe(true);
  });
  it('контроль: сводка с отступом внутри упавшего утверждения — не конец', () => {
    expect(finished('    Expected: "Test Suites: 1 passed, 1 total"')).toBe(
      false,
    );
  });
});
