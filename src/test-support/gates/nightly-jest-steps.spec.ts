// nightly.yml, джоба backend-flaky: каждый jest — через сторожа
// (scripts/jest-exit-guard.mjs, его поведение — jest-exit-guard.spec.ts), и
// таймауты сложены так, что зависший шаг падает сам, с причиной, раньше, чем
// джобу снимут целиком (правило №24). Инцидент 2026-10-15 (ci-alarm #672):
// `npx jest --detectOpenHandles … | tail -50` висел 27 минут без единой строки.
//
// YAML-парсера в зависимостях нет: шаги режутся по отступу, как в
// alarm-workflow.spec.ts.
import { readFileSync } from 'fs';
import { join } from 'path';

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

/** Команда шага; свёрнутый `run: >-` (строки блока — на 10 пробелах) склеен через пробел. */
function runOf(step: string): string {
  const value = stepField(step, 'run') ?? '';
  if (!/^>-?$/.test(value)) return value;
  const body = step
    .slice(step.search(/^(?: {8})?run: >/m))
    .split('\n')
    .slice(1);
  const end = body.findIndex(
    (l) => l.trim() !== '' && !l.startsWith(' '.repeat(10)),
  );
  return (end < 0 ? body : body.slice(0, end))
    .map((l) => l.trim())
    .filter(Boolean)
    .join(' ');
}

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

// ci.yml, джоба backend: до сторожа утечку в PR-CI видела только строка в
// логе зелёного шага — так поллинг из telegram.polling.seam.spec.ts (#649)
// уехал в main при зелёном шаге со строкой «A worker process has failed to
// exit gracefully» и повесил nightly (ci-alarm #672). Сторож стоит на полном
// юнит-прогоне под Australia/Sydney и на e2e (держатель после app.close() был
// виден лишь строкой «Jest did not exit»). Прогон coverage-храповика он не
// оборачивает — красный храповик (просадка покрытия при зелёных тестах)
// сторож прочитал бы как «код выхода выставил тест».
describe('ci.yml, backend: юнит-jest и e2e через jest-exit-guard', () => {
  const CI = readFileSync(
    join(process.cwd(), '.github', 'workflows', 'ci.yml'),
    'utf8',
  );
  const backend = job(CI, 'backend');
  const steps = backend.split(/^ {6}- /m).slice(1);
  const GUARDED = /^node scripts\/jest-exit-guard\.mjs .* -- npx jest\b/;
  const unit = steps.filter(
    (s) => /\bnpx jest\b/.test(runOf(s)) && !/--config/.test(runOf(s)),
  );
  const e2e = steps.filter((s) =>
    /\bnpx jest --config \.\/test\/jest-e2e\.json\b/.test(runOf(s)),
  );
  const step = { юнит: unit[0], e2e: e2e[0] };

  it('полный юнит-прогон jest в джобе есть (под не-UTC зоной), e2e-шаг — один', () => {
    expect(unit).toHaveLength(1);
    expect(unit[0]).toMatch(/^ {10}TZ: Australia\/Sydney$/m);
    expect(e2e).toHaveLength(1);
  });

  it.each(['юнит', 'e2e'] as const)(
    '%s: через сторожа, без пайпа и без --forceExit',
    (key) => {
      const cmd = runOf(step[key]);
      expect(cmd).toMatch(GUARDED);
      expect(cmd).not.toMatch(/\|/);
      expect(cmd).not.toMatch(/--forceExit/);
    },
  );

  it.each(['юнит', 'e2e'] as const)(
    '%s: бюджет + ожидание выхода + минута запаса ≤ timeout-minutes шага < джобы',
    (key) => {
      const cmd = runOf(step[key]);
      const budget = Number(/--budget (\d+)/.exec(cmd)?.[1]);
      const grace = Number(/--exit-grace (\d+)/.exec(cmd)?.[1]);
      const minutes = Number(stepField(step[key], 'timeout-minutes'));
      const jobMinutes = Number(
        /^ {4}timeout-minutes: (\d+)$/m.exec(backend)?.[1],
      );
      expect(budget).toBeGreaterThan(0);
      expect(grace).toBeGreaterThan(0);
      expect(budget + grace + 60).toBeLessThanOrEqual(minutes * 60);
      expect(minutes).toBeLessThan(jobMinutes);
    },
  );

  it('контроль: свёрнутый e2e-шаг без сторожа (как до обёртки) проверку не проходит', () => {
    const bare = [
      'run: >-',
      '          npx jest --config ./test/jest-e2e.json',
      '          test/app-auth',
      '      # следующий шаг',
    ].join('\n');
    expect(runOf(bare)).toBe(
      'npx jest --config ./test/jest-e2e.json test/app-auth',
    );
    expect(runOf(bare)).not.toMatch(GUARDED);
  });
});
