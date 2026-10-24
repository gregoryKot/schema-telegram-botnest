// Тест гейта check-color-drift.mjs: пофайловый храповик захардкоженных
// хроматических цветовых литералов (hex/rgb) во фронтендах — PR #516 перевёл
// ~40 таких литералов на токены/color-mix, но без гейта следующий PR снова
// написал бы rgba(239,68,68,0.08) мимо палитры. Проверяет оба исхода — гейт
// краснеет на регрессе и зеленеет на чистом дереве (правило «Тестовые
// храповики и e2e» CLAUDE.md).
import { readFileSync } from 'fs';
import { join } from 'path';
import { runGate, cleanupTmp } from './gate-sandbox';
import { loadStringList, loadRegexList } from './pattern-loader';

describe('check-color-drift.mjs', () => {
  it('новый файл с rgba() мимо палитры — exit 1', () => {
    const res = runGate('check-color-drift.mjs', {
      'scripts/color-drift-baseline.json': JSON.stringify({}),
      'webapp/src/foo.tsx':
        "export const x = <div style={{ background: 'rgba(239,68,68,0.08)' }} />;\n",
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      'webapp/src/foo.tsx: новый файл с 1 цветовыми литералами',
    );
    expect(res.stderr).toContain('rgba(239,68,68');
  });

  it('рост счётчика в известном файле — exit 1 с "было → стало"', () => {
    const res = runGate('check-color-drift.mjs', {
      'scripts/color-drift-baseline.json': JSON.stringify({
        'webapp/src/known.tsx': 1,
      }),
      'webapp/src/known.tsx': [
        "const a = '#ef4444';",
        "const b = '#22c55e';",
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('webapp/src/known.tsx: 1 → 2');
  });

  it('снижение счётчика — exit 0, предлагает зафиксировать --update', () => {
    const res = runGate('check-color-drift.mjs', {
      'scripts/color-drift-baseline.json': JSON.stringify({
        'shared/src/known.ts': 2,
      }),
      'shared/src/known.ts': "const a = '#ef4444';\n",
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('1 < 2 — стало лучше');
  });

  it('ахроматика (чёрный/белый/серый, в т.ч. через var(--fg-rgb)) не считается', () => {
    const res = runGate('check-color-drift.mjs', {
      'scripts/color-drift-baseline.json': JSON.stringify({}),
      'webapp/src/clean.tsx': [
        "const a = 'rgba(0,0,0,0.3)';",
        "const b = 'rgba(255,255,255,.06)';",
        "const c = '#fff';",
        "const d = '#1a1a1a';",
        "const e = 'rgba(var(--fg-rgb),0.1)';",
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain(
      '✓ Храповик цветовых литералов: 0 (без роста)',
    );
  });

  it('токены и color-mix не считаются', () => {
    const res = runGate('check-color-drift.mjs', {
      'scripts/color-drift-baseline.json': JSON.stringify({}),
      'webapp/src/clean.tsx':
        "const a = 'var(--accent-red)';\n" +
        "const b = 'color-mix(in srgb, var(--accent-red) 8%, transparent)';\n",
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain(
      '✓ Храповик цветовых литералов: 0 (без роста)',
    );
  });

  it('литерал только в комментарии не считается', () => {
    const res = runGate('check-color-drift.mjs', {
      'scripts/color-drift-baseline.json': JSON.stringify({}),
      'webapp/src/commented.tsx': [
        '// см. PR #349',
        "// старый цвет был '#ef4444', теперь токен",
        "const a = 'var(--accent-red)';",
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain(
      '✓ Храповик цветовых литералов: 0 (без роста)',
    );
  });

  it('ОБРАЗЕЦ: брендовый цвет Google в LoginProviderButtons — зелено', () => {
    const res = runGate('check-color-drift.mjs', {
      'scripts/color-drift-baseline.json': JSON.stringify({}),
      'webapp/src/pages/login/LoginProviderButtons.tsx':
        'const GoogleIcon = () => <path fill="#EA4335" />;\n',
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain(
      '✓ Храповик цветовых литералов: 0 (без роста)',
    );
  });

  it('КОНТРОЛЬ: тот же файл, но НЕ брендовый цвет — по-прежнему красный', () => {
    const res = runGate('check-color-drift.mjs', {
      'scripts/color-drift-baseline.json': JSON.stringify({}),
      'webapp/src/pages/login/LoginProviderButtons.tsx':
        'const NotBrand = () => <path fill="#ef4444" />;\n',
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('#ef4444');
  });

  it('ОБРАЗЕЦ: canvas-исключение shared/src/share/ — зелено', () => {
    const res = runGate('check-color-drift.mjs', {
      'scripts/color-drift-baseline.json': JSON.stringify({}),
      'shared/src/share/cards/x.ts': "const COLOR = '#a78bfa';\n",
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain(
      '✓ Храповик цветовых литералов: 0 (без роста)',
    );
  });

  it('КОНТРОЛЬ: тот же литерал вне исключения (needColors.ts) — красный', () => {
    const res = runGate('check-color-drift.mjs', {
      'scripts/color-drift-baseline.json': JSON.stringify({}),
      'shared/src/needs/needColors.ts':
        "export const NEED_COLORS = { limits: '#a78bfa' };\n",
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('shared/src/needs/needColors.ts');
    expect(res.stderr).toContain('#a78bfa');
  });

  it('ОБРАЗЕЦ: парная запись css/hex в journeyMeta.ts — зелено', () => {
    const res = runGate('check-color-drift.mjs', {
      'scripts/color-drift-baseline.json': JSON.stringify({}),
      'shared/src/journey/journeyMeta.ts':
        "  tracker: { css: 'var(--accent-blue)', hex: '#60a5fa' },\n",
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain(
      '✓ Храповик цветовых литералов: 0 (без роста)',
    );
  });

  it('КОНТРОЛЬ: одинокий hex без пары css: — по-прежнему красный', () => {
    const res = runGate('check-color-drift.mjs', {
      'scripts/color-drift-baseline.json': JSON.stringify({}),
      'shared/src/journey/journeyMeta.ts': "  tracker: { hex: '#60a5fa' },\n",
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('#60a5fa');
  });

  it('нет бейслайна — понятная ошибка, exit 1', () => {
    const res = runGate('check-color-drift.mjs', {
      'webapp/src/clean.tsx': "const a = 'var(--accent-red)';\n",
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('Нет бейслайна');
  });

  it('--update пишет отсортированный бейслайн', () => {
    const res = runGate(
      'check-color-drift.mjs',
      {
        'webapp/src/z.tsx': "const a = '#ef4444';\n",
        'webapp/src/a.tsx': "const a = '#22c55e';\n",
      },
      { args: ['--update'], keepTmp: true },
    );
    expect(res.status).toBe(0);
    const written = JSON.parse(
      readFileSync(join(res.tmp, 'scripts/color-drift-baseline.json'), 'utf8'),
    );
    expect(Object.keys(written)).toEqual([
      'webapp/src/a.tsx',
      'webapp/src/z.tsx',
    ]);
    cleanupTmp(res.tmp);
  });

  it('вне SCAN_DIRS (например src/) не сканируется', () => {
    const res = runGate('check-color-drift.mjs', {
      'scripts/color-drift-baseline.json': JSON.stringify({}),
      'src/some-backend-file.ts': "const c = '#ef4444';\n",
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain(
      '✓ Храповик цветовых литералов: 0 (без роста)',
    );
  });
});

// Пиннинг трёх списков-исключений по имени — того требует check-gate-
// exemptions.mjs (правило №15 CLAUDE.md: у каждого исключения есть тест на
// своё имя, а не молчаливый пропуск).
describe('списки-исключения check-color-drift.mjs запинены по имени', () => {
  it('ALLOW_BRAND_COLORS содержит брендовые цвета Google и VK', () => {
    const brands = loadStringList(
      'check-color-drift.mjs',
      'ALLOW_BRAND_COLORS',
    );
    expect(brands).toEqual(
      expect.arrayContaining([
        '#4285F4',
        '#34A853',
        '#FBBC05',
        '#EA4335',
        '#0077FF',
      ]),
    );
  });

  it('EXCLUDE_FILES содержит три ожидаемых пути', () => {
    const files = loadStringList('check-color-drift.mjs', 'EXCLUDE_FILES');
    expect(files).toEqual(
      expect.arrayContaining([
        'shared/src/share/',
        'shared/src/hooks/useConfetti.ts',
        'webapp/src/pages/landing/aurora.ts',
      ]),
    );
  });

  it('EXCLUDE_LINE_PATTERNS непуст и матчит парную запись, но не одинокий hex:', () => {
    const patterns = loadRegexList(
      'check-color-drift.mjs',
      'EXCLUDE_LINE_PATTERNS',
    );
    expect(patterns.length).toBeGreaterThan(0);
    const re = new RegExp(patterns[0].source, patterns[0].flags);
    expect(
      re.test("  tracker: { css: 'var(--accent-blue)', hex: '#60a5fa' },"),
    ).toBe(true);
    expect(re.test("  tracker: { hex: '#60a5fa' },")).toBe(false);
  });
});
