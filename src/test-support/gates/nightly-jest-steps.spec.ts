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
