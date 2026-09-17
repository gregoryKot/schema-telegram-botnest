// Тесты гейтов eslint- и jscpd-храповиков.
//
// Оба гейта запускают внешний бинарь по всему дереву проекта, и целиком в
// песочницу их не поднять: типизированный eslint требует настоящий
// tsconfig-проект с зависимостями, jscpd — секунды на обход. Но опасная
// половина у них другая — разбор отчёта и сверка с бейслайном. Именно она
// молча пропускает регресс, если однажды сломается: гейт напечатает «✓» и
// выйдет с нулём, а counter-регресс уедет в main.
//
// Поэтому в обоих скриптах есть шов RATCHET_REPORT_FILE: подставляет готовый
// отчёт вместо запуска бинаря. Тест проходит ровно тот же код сравнения, что
// работает в CI, — меняется только источник JSON. Сам внешний инструмент
// песочницей не заменить, и это честно записано: его поведение проверяет
// прогон в CI, а не этот файл.
import { readFileSync } from 'fs';
import { runGate, cleanupTmp } from './gate-sandbox';

const eslintReport = (
  entries: Array<{ file: string; rule: string; count: number }>,
) =>
  JSON.stringify(
    entries.map((e) => ({
      filePath: e.file,
      errorCount: e.count,
      warningCount: 0,
      messages: Array.from({ length: e.count }, (_, i) => ({
        ruleId: e.rule,
        line: i + 1,
        message: 'подробность нарушения',
      })),
    })),
  );

const jscpdReport = (duplicatedLines: number, clones: number) =>
  JSON.stringify({ statistics: { total: { duplicatedLines, clones } } });

/** Отчёт кладём внутрь песочницы и указываем относительным путём: скрипт
 * запускается с cwd = песочница, поэтому путь резолвится туда же. */
const withReport = (
  report: string,
  baselinePath: string,
  baseline: string,
) => ({
  files: { 'report.json': report, [baselinePath]: baseline },
  env: { ...process.env, RATCHET_REPORT_FILE: 'report.json' } as Record<
    string,
    string
  >,
});

describe('гейт: eslint-храповик', () => {
  it('рост счётчика роняет гейт и называет правило с файлом', () => {
    const { files, env } = withReport(
      eslintReport([
        { file: '/repo/src/a.ts', rule: 'no-explicit-any', count: 3 },
      ]),
      'scripts/eslint-baseline.json',
      JSON.stringify({
        total: 1,
        errors: 1,
        warnings: 0,
        byRule: { 'no-explicit-any': 1 },
      }),
    );
    const res = runGate('check-eslint-ratchet.mjs', files, { env });

    expect(res.status).toBe(1);
    expect(res.stderr).toContain('1 → 3');
    expect(res.stderr).toContain('no-explicit-any');
    expect(res.stderr).toContain('/repo/src/a.ts');
  });

  it('счётчик не вырос — гейт зелёный (иначе его отключат через неделю)', () => {
    const { files, env } = withReport(
      eslintReport([
        { file: '/repo/src/a.ts', rule: 'no-explicit-any', count: 2 },
      ]),
      'scripts/eslint-baseline.json',
      JSON.stringify({
        total: 2,
        errors: 2,
        warnings: 0,
        byRule: { 'no-explicit-any': 2 },
      }),
    );
    const res = runGate('check-eslint-ratchet.mjs', files, { env });

    expect(res.status).toBe(0);
    expect(res.stdout).toContain('без роста');
  });

  it('снижение — гейт зелёный и зовёт зафиксировать прогресс', () => {
    const { files, env } = withReport(
      eslintReport([]),
      'scripts/eslint-baseline.json',
      JSON.stringify({
        total: 5,
        errors: 5,
        warnings: 0,
        byRule: { 'no-explicit-any': 5 },
      }),
    );
    const res = runGate('check-eslint-ratchet.mjs', files, { env });

    expect(res.status).toBe(0);
    expect(res.stdout).toContain('--update');
  });

  it('битый отчёт роняет гейт, а не считается «нулём нарушений»', () => {
    // Самый опасный исход для храповика: инструмент не отработал, счётчик
    // вышел нулевым, и гейт радостно зазеленел на пустоте.
    const res = runGate(
      'check-eslint-ratchet.mjs',
      {
        'report.json': 'не json',
        'scripts/eslint-baseline.json': JSON.stringify({
          total: 0,
          errors: 0,
          warnings: 0,
          byRule: {},
        }),
      },
      { env: { ...process.env, RATCHET_REPORT_FILE: 'report.json' } },
    );

    expect(res.status).toBe(1);
    expect(res.stderr).toContain('не отработал');
  });

  it('--update перезаписывает бейслайн текущими числами', () => {
    const { files, env } = withReport(
      eslintReport([
        { file: '/repo/src/a.ts', rule: 'no-explicit-any', count: 4 },
      ]),
      'scripts/eslint-baseline.json',
      JSON.stringify({ total: 0, errors: 0, warnings: 0, byRule: {} }),
    );
    const res = runGate('check-eslint-ratchet.mjs', files, {
      env,
      args: ['--update'],
      keepTmp: true,
    });

    try {
      expect(res.status).toBe(0);
      const written = JSON.parse(
        readFileSync(`${res.tmp}/scripts/eslint-baseline.json`, 'utf8'),
      ) as { total: number; byRule: Record<string, number> };
      expect(written.total).toBe(4);
      expect(written.byRule['no-explicit-any']).toBe(4);
    } finally {
      cleanupTmp(res.tmp);
    }
  });
});

describe('гейт: jscpd-храповик', () => {
  it('рост дублированных строк роняет гейт с обоими числами', () => {
    const { files, env } = withReport(
      jscpdReport(500, 20),
      'scripts/jscpd-baseline.json',
      JSON.stringify({ lines: 100, clones: 5 }),
    );
    const res = runGate('check-jscpd-ratchet.mjs', files, { env });

    expect(res.status).toBe(1);
    expect(res.stderr).toContain('100 → 500');
  });

  it('столько же строк — гейт зелёный', () => {
    const { files, env } = withReport(
      jscpdReport(100, 5),
      'scripts/jscpd-baseline.json',
      JSON.stringify({ lines: 100, clones: 5 }),
    );
    const res = runGate('check-jscpd-ratchet.mjs', files, { env });

    expect(res.status).toBe(0);
    expect(res.stdout).toContain('без роста');
  });

  it('дублей стало меньше — зелёный и предлагает зафиксировать', () => {
    const { files, env } = withReport(
      jscpdReport(40, 2),
      'scripts/jscpd-baseline.json',
      JSON.stringify({ lines: 100, clones: 5 }),
    );
    const res = runGate('check-jscpd-ratchet.mjs', files, { env });

    expect(res.status).toBe(0);
    expect(res.stdout).toContain('стало лучше');
  });

  it('нет бейслайна — гейт падает, а не молчит', () => {
    const res = runGate(
      'check-jscpd-ratchet.mjs',
      { 'report.json': jscpdReport(10, 1) },
      { env: { ...process.env, RATCHET_REPORT_FILE: 'report.json' } },
    );

    expect(res.status).toBe(1);
    expect(res.stderr).toContain('Нет бейслайна');
  });
});
