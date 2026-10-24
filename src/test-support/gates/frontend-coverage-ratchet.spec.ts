// Тест гейта check-frontend-coverage-ratchet.mjs (правило CLAUDE.md «тесты
// распространяются на фронтенды»). Как и бэкендовый check-coverage-ratchet,
// скрипт сам гоняет `npx vitest run --coverage` — подсовываем фейковый npx
// (makeFakeNpx), реальный vitest в песочнице не поднимаем.
//
// Гоняем только с --package webapp, чтобы не создавать фикстуры для
// schema-miniapp/shared — поведение гейта на них идентично.
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
  return env;
}

describe('check-frontend-coverage-ratchet.mjs', () => {
  it('[webapp] просадка покрытия — exit 1', () => {
    const fake = makeFakeNpx();
    try {
      const res = runGate(
        'check-frontend-coverage-ratchet.mjs',
        {
          'scripts/frontend-coverage-baseline.json': JSON.stringify({
            webapp: { lines: 80, branches: 70 },
          }),
          // vitest запускается с cwd=<ROOT>/webapp — каталог должен существовать.
          'webapp/.keep': '',
        },
        {
          args: ['--package', 'webapp'],
          env: envWithFakeNpx(fake.binDir, {
            total: { lines: { pct: 70 }, branches: { pct: 70 } },
          }),
        },
      );
      expect(res.status).toBe(1);
      expect(res.stderr).toContain('[webapp] coverage-храповик');
      expect(res.stderr).toContain('lines: 80% → 70%');
    } finally {
      fake.cleanup();
    }
  });

  it('[webapp] рост покрытия — exit 0, предлагает зафиксировать прогресс', () => {
    const fake = makeFakeNpx();
    try {
      const res = runGate(
        'check-frontend-coverage-ratchet.mjs',
        {
          'scripts/frontend-coverage-baseline.json': JSON.stringify({
            webapp: { lines: 80, branches: 70 },
          }),
          'webapp/.keep': '',
        },
        {
          args: ['--package', 'webapp'],
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

  it('[webapp] пакета нет в бейслайне — exit 1', () => {
    const fake = makeFakeNpx();
    try {
      const res = runGate(
        'check-frontend-coverage-ratchet.mjs',
        {
          'scripts/frontend-coverage-baseline.json': JSON.stringify({}),
          'webapp/.keep': '',
        },
        {
          args: ['--package', 'webapp'],
          env: envWithFakeNpx(fake.binDir, {
            total: { lines: { pct: 85 }, branches: { pct: 75 } },
          }),
        },
      );
      expect(res.status).toBe(1);
      expect(res.stderr).toContain('[webapp] нет в бейслайне');
    } finally {
      fake.cleanup();
    }
  });

  // Находка 2026-10-24: вывод vitest терялся хвостом при process.exit в pipe
  // (см. coverage-ratchet.spec.ts). Читаем через pipe — как CI.
  it('[webapp] vitest упал и написал > 1 МБ лога — хвост вывода и сообщение храповика доходят целиком', () => {
    const fake = makeFakeNpx();
    try {
      const res = runGate(
        'check-frontend-coverage-ratchet.mjs',
        {
          'scripts/frontend-coverage-baseline.json': JSON.stringify({
            webapp: { lines: 80, branches: 70 },
          }),
          'webapp/.keep': '',
        },
        {
          args: ['--package', 'webapp'],
          env: {
            ...envWithFakeNpx(fake.binDir),
            FAKE_NPX_NOISE_KB: '1536',
            FAKE_NPX_EXIT: '1',
          },
        },
      );
      expect(res.status).toBe(1);
      expect(res.stdout).toContain('NPX_TAIL_STDOUT');
      expect(res.stderr).toContain('NPX_TAIL_STDERR');
      expect(res.stderr).toContain('vitest завершился с ошибкой');
    } finally {
      fake.cleanup();
    }
  });

  it('[webapp] vitest прошёл с логом > 1 МБ, покрытие в норме — итог храповика дописан после лога, exit 0', () => {
    const fake = makeFakeNpx();
    try {
      const res = runGate(
        'check-frontend-coverage-ratchet.mjs',
        {
          'scripts/frontend-coverage-baseline.json': JSON.stringify({
            webapp: { lines: 80, branches: 70 },
          }),
          'webapp/.keep': '',
        },
        {
          args: ['--package', 'webapp'],
          env: {
            ...envWithFakeNpx(fake.binDir, {
              total: { lines: { pct: 80 }, branches: { pct: 70 } },
            }),
            FAKE_NPX_NOISE_KB: '1536',
          },
        },
      );
      expect(res.status).toBe(0);
      expect(res.stdout).toContain('NPX_TAIL_STDOUT');
      expect(res.stdout).toContain('[webapp] coverage-храповик');
    } finally {
      fake.cleanup();
    }
  });
});
