// Тест гейта check-coverage-ratchet.mjs. Скрипт сам запускает `npx jest
// --coverage` — гонять реальный jest внутри тестовой песочницы дорого и не
// нужно: проверяем читателя coverage-summary.json, а не сам jest. Подсовываем
// фейковый `npx` через PATH (makeFakeNpx) — он пишет заранее заданный
// coverage-summary.json вместо настоящего прогона.
import { makeFakeNpx, runGate } from './gate-sandbox';

function envWithFakeNpx(
  binDir: string,
  summary?: unknown,
): Record<string, string> {
  const env: Record<string, string> = {
    ...process.env,
    PATH: `${binDir}:${process.env.PATH ?? ''}`,
  };
  if (summary !== undefined) env.FAKE_NPX_SUMMARY = JSON.stringify(summary);
  else delete env.FAKE_NPX_SUMMARY;
  return env;
}

describe('check-coverage-ratchet.mjs', () => {
  it('просадка общего % покрытия — exit 1', () => {
    const fake = makeFakeNpx();
    try {
      const res = runGate(
        'check-coverage-ratchet.mjs',
        {
          'scripts/coverage-baseline.json': JSON.stringify({
            lines: 80,
            branches: 70,
            floors: {},
          }),
        },
        {
          env: envWithFakeNpx(fake.binDir, {
            total: { lines: { pct: 70 }, branches: { pct: 70 } },
          }),
        },
      );
      expect(res.status).toBe(1);
      expect(res.stderr).toContain('lines: 80% → 70%');
    } finally {
      fake.cleanup();
    }
  });

  it('просадка пола по каталогу (src/auth) — exit 1, общий % не падает', () => {
    const fake = makeFakeNpx();
    try {
      const res = runGate(
        'check-coverage-ratchet.mjs',
        {
          'scripts/coverage-baseline.json': JSON.stringify({
            lines: 80,
            branches: 70,
            floors: { 'src/auth': 90 },
          }),
        },
        {
          env: envWithFakeNpx(fake.binDir, {
            total: { lines: { pct: 80 }, branches: { pct: 70 } },
            'src/auth/foo.ts': { lines: { total: 10, covered: 5 } },
          }),
        },
      );
      expect(res.status).toBe(1);
      expect(res.stderr).toContain('src/auth: 50.00% < пола 90%');
    } finally {
      fake.cleanup();
    }
  });

  it('рост покрытия — exit 0, предлагает зафиксировать прогресс', () => {
    const fake = makeFakeNpx();
    try {
      const res = runGate(
        'check-coverage-ratchet.mjs',
        {
          'scripts/coverage-baseline.json': JSON.stringify({
            lines: 80,
            branches: 70,
            floors: {},
          }),
        },
        {
          env: envWithFakeNpx(fake.binDir, {
            total: { lines: { pct: 85 }, branches: { pct: 75 } },
          }),
        },
      );
      expect(res.status).toBe(0);
      expect(res.stdout).toContain('стало лучше');
    } finally {
      fake.cleanup();
    }
  });

  it('нет coverage-summary.json после прогона — exit 1, гейт не зеленеет без данных', () => {
    const fake = makeFakeNpx();
    try {
      const res = runGate(
        'check-coverage-ratchet.mjs',
        {
          'scripts/coverage-baseline.json': JSON.stringify({
            lines: 80,
            branches: 70,
            floors: {},
          }),
        },
        {
          env: envWithFakeNpx(fake.binDir), // FAKE_NPX_SUMMARY не задан — отчёт не пишется
        },
      );
      expect(res.status).toBe(1);
      expect(res.stderr).toContain('не найден');
      expect(res.stderr).toContain('coverage-summary.json');
    } finally {
      fake.cleanup();
    }
  });
});
