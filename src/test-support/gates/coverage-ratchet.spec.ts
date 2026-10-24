// Тест гейта check-coverage-ratchet.mjs. Скрипт сам запускает `npx jest
// --coverage` — гонять реальный jest внутри тестовой песочницы дорого и не
// нужно: проверяем читателя coverage-summary.json, а не сам jest. Подсовываем
// фейковый `npx` через PATH (makeFakeNpx) — он пишет заранее заданный
// coverage-summary.json вместо настоящего прогона.
import { makeFakeNpx } from './fake-npx';
import { runGate } from './gate-sandbox';

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

// Лог Nest у настоящего jest — 100–200 КБ, а pipe до process.exit успевает
// принять ~64 КБ. 1,5 МБ в каждый поток: на старом поведении хвост срезается
// наверняка, на любой машине.
const NOISE_KB = '1536';
const NOISE_BYTES = Number(NOISE_KB) * 1024;

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

  // Находка 2026-10-24 (PR #836, #843): гейт писал вывод jest через
  // process.stdout.write и сразу делал process.exit — в pipe (так в CI) хвост
  // с FAIL, сводкой jest и сообщением храповика терялся, шаг краснел без
  // причины. spawnSync в runGate читает вывод именно через pipe.
  it('jest упал и написал > 1 МБ лога — хвост вывода и сообщение храповика доходят целиком', () => {
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
          env: {
            ...envWithFakeNpx(fake.binDir),
            FAKE_NPX_NOISE_KB: NOISE_KB,
            FAKE_NPX_EXIT: '1',
          },
        },
      );
      expect(res.status).toBe(1);
      expect(res.stdout.length).toBeGreaterThan(NOISE_BYTES);
      expect(res.stderr.length).toBeGreaterThan(NOISE_BYTES);
      expect(res.stdout).toContain('NPX_TAIL_STDOUT');
      expect(res.stderr).toContain('NPX_TAIL_STDERR');
      expect(res.stderr).toContain('jest завершился с ошибкой');
    } finally {
      fake.cleanup();
    }
  });

  it('jest прошёл с логом > 1 МБ, покрытие просело — итог храповика не срезан, exit 1', () => {
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
          env: {
            ...envWithFakeNpx(fake.binDir, {
              total: { lines: { pct: 70 }, branches: { pct: 70 } },
            }),
            FAKE_NPX_NOISE_KB: NOISE_KB,
          },
        },
      );
      expect(res.status).toBe(1);
      expect(res.stdout).toContain('NPX_TAIL_STDOUT');
      expect(res.stderr).toContain('NPX_TAIL_STDERR');
      expect(res.stderr).toContain('lines: 80% → 70%');
      expect(res.stderr).toContain('TEST_COVERAGE_PLAN.md');
    } finally {
      fake.cleanup();
    }
  });

  it('jest прошёл с логом > 1 МБ, покрытие в норме — «✓ coverage-храповик» дописан после лога, exit 0', () => {
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
          env: {
            ...envWithFakeNpx(fake.binDir, {
              total: { lines: { pct: 80 }, branches: { pct: 70 } },
            }),
            FAKE_NPX_NOISE_KB: NOISE_KB,
          },
        },
      );
      expect(res.status).toBe(0);
      expect(res.stdout.length).toBeGreaterThan(NOISE_BYTES);
      expect(res.stdout).toContain('NPX_TAIL_STDOUT');
      expect(res.stdout).toContain('✓ coverage-храповик');
    } finally {
      fake.cleanup();
    }
  });
});
