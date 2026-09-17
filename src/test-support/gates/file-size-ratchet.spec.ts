// Тест гейта check-file-size-ratchet.mjs (правило №10 CLAUDE.md: лимит
// размера файла). Скрипт сам вызывает `git ls-files`, поэтому песочница
// должна быть настоящим git-репозиторием (runGate(..., { git: true })) —
// иначе он видит пустой список файлов и молча зеленеет на чём угодно.
import { readFileSync } from 'fs';
import { join } from 'path';
import { linesOfLength, runGate, cleanupTmp } from './gate-sandbox';
import { loadRegexList } from './pattern-loader';

describe('check-file-size-ratchet.mjs', () => {
  it('новый файл (не в бейслайне) больше потолка 300 строк — exit 1', () => {
    const res = runGate(
      'check-file-size-ratchet.mjs',
      {
        'scripts/file-size-baseline.json': JSON.stringify({ 'src/old.ts': 50 }),
        'src/old.ts': linesOfLength(50),
        'src/big.ts': linesOfLength(310),
      },
      { git: true },
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('src/big.ts: 310');
    expect(res.stderr).toContain('потолка 300');
  });

  it('файл из бейслайна вырос — exit 1 с "было → стало"', () => {
    const res = runGate(
      'check-file-size-ratchet.mjs',
      {
        'scripts/file-size-baseline.json': JSON.stringify({
          'src/grow.ts': 100,
        }),
        'src/grow.ts': linesOfLength(150),
      },
      { git: true },
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('src/grow.ts: 100 → 150 (+50)');
  });

  it('файл из бейслайна уменьшился — exit 0, гейт предлагает зафиксировать прогресс', () => {
    const res = runGate(
      'check-file-size-ratchet.mjs',
      {
        'scripts/file-size-baseline.json': JSON.stringify({
          'src/shrink.ts': 100,
        }),
        'src/shrink.ts': linesOfLength(60),
      },
      { git: true },
    );
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('✓ файл-храповик');
    expect(res.stdout).toContain('1 файлов усохло');
  });

  it('--update фиксирует актуальные размеры в scripts/file-size-baseline.json', () => {
    const res = runGate(
      'check-file-size-ratchet.mjs',
      {
        'src/a.ts': linesOfLength(10),
        'src/b.ts': linesOfLength(20),
      },
      { git: true, args: ['--update'], keepTmp: true },
    );
    try {
      expect(res.status).toBe(0);
      const written = JSON.parse(
        readFileSync(
          join(res.tmp, 'scripts', 'file-size-baseline.json'),
          'utf8',
        ),
      ) as Record<string, number>;
      expect(written['src/a.ts']).toBe(10);
      expect(written['src/b.ts']).toBe(20);
    } finally {
      cleanupTmp(res.tmp);
    }
  });

  // Регресс на конкретный случай: игра заморожена решением владельца
  // (шапка скрипта) — гигантский файл под game/ не имеет права уронить CI.
  it('огромный файл под game/ не считается — заморожен решением владельца', () => {
    const res = runGate(
      'check-file-size-ratchet.mjs',
      {
        'scripts/file-size-baseline.json': JSON.stringify({}),
        'game/src/huge.ts': linesOfLength(500),
      },
      { git: true },
    );
    expect(res.status).toBe(0);
  });

  it('КОНТРОЛЬ: тот же по размеру файл вне game/ — по-прежнему exit 1', () => {
    const res = runGate(
      'check-file-size-ratchet.mjs',
      {
        'scripts/file-size-baseline.json': JSON.stringify({}),
        'src/huge.ts': linesOfLength(500),
      },
      { git: true },
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('src/huge.ts: 500');
  });
});

// Механизм вместо добросовестности (как ALLOW в check-gendered-forms.mjs): у
// КАЖДОГО исключения EXCLUDE обязан быть образец, который оно распознаёт —
// иначе следующий редактор может опустошить список бесследно.
describe('каждое исключение EXCLUDE распознаёт свой образец', () => {
  const EXCLUDE = loadRegexList('check-file-size-ratchet.mjs', 'EXCLUDE');

  const CORPUS = [
    'node_modules/foo/index.ts',
    'webapp/dist/main.js',
    'coverage/lcov-report/index.html',
    'schema-miniapp/build/bundle.js',
    'src/foo.d.ts',
    'src/foo.spec.ts',
    'test/auth-flows.e2e-spec.ts',
    'webapp/src/foo.test.tsx',
    'game/src/level.ts',
    'webapp/public/max-bridge.js',
  ];

  it('у каждого исключения есть образец, который оно распознаёт', () => {
    const unmatched = EXCLUDE.filter(
      (p) => !CORPUS.some((text) => new RegExp(p.source, p.flags).test(text)),
    );
    expect(unmatched).toEqual([]);
  });

  // Контрольные образцы: исключение для тестов не должно оказаться шире,
  // чем нужно, — обычный код обязан остаться под храповиком.
  it('исключение тестов не выпускает из-под гейта обычный код', () => {
    const covered = (text: string) =>
      EXCLUDE.some((p) => new RegExp(p.source, p.flags).test(text));
    expect(covered('test/e2e-support/fake-prisma.ts')).toBe(false);
    expect(covered('src/auth/auth.service.ts')).toBe(false);
    expect(covered('webapp/src/components/Inspector.ts')).toBe(false);
    expect(covered('src/spec.ts')).toBe(false);
  });
});
