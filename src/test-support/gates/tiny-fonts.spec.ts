// Тест гейта check-tiny-fonts.mjs (дизайн-аудит 2026-08, В1): пофайловый
// храповик inline `fontSize:` ниже 11px. Проверяет оба исхода — гейт
// краснеет на регрессе и зеленеет на чистом дереве (правило «Тестовые
// храповики и e2e» CLAUDE.md).
import { readFileSync } from 'fs';
import { join } from 'path';
import { runGate, cleanupTmp } from './gate-sandbox';

describe('check-tiny-fonts.mjs', () => {
  it('новый файл с fontSize ниже 11 — exit 1', () => {
    const res = runGate('check-tiny-fonts.mjs', {
      'scripts/tiny-fonts-baseline.json': JSON.stringify({}),
      'webapp/src/foo.tsx':
        'export const x = <span style={{ fontSize: 7 }} />;\n',
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      'webapp/src/foo.tsx: новый файл с 1 подпороговыми fontSize',
    );
    expect(res.stderr).toContain('fontSize: 7');
  });

  it('рост счётчика в известном файле — exit 1 с "было → стало"', () => {
    const res = runGate('check-tiny-fonts.mjs', {
      'scripts/tiny-fonts-baseline.json': JSON.stringify({
        'schema-miniapp/src/known.tsx': 1,
      }),
      'schema-miniapp/src/known.tsx': [
        'const a = { fontSize: 8 };',
        'const b = { fontSize: 9 };',
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('schema-miniapp/src/known.tsx: 1 → 2');
  });

  it('снижение счётчика — exit 0, предлагает зафиксировать --update', () => {
    const res = runGate('check-tiny-fonts.mjs', {
      'scripts/tiny-fonts-baseline.json': JSON.stringify({
        'shared/src/known.tsx': 2,
      }),
      'shared/src/known.tsx': 'const a = { fontSize: 9 };\n',
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('1 < 2 — стало лучше');
  });

  it('fontSize на пороге (11) и выше — не считается', () => {
    const res = runGate('check-tiny-fonts.mjs', {
      'scripts/tiny-fonts-baseline.json': JSON.stringify({}),
      'webapp/src/clean.tsx':
        'const a = { fontSize: 11 };\nconst b = { fontSize: 15 };\n',
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain(
      '✓ Храповик подпороговых fontSize: 0 (без роста)',
    );
  });

  it('строковый fontSize ("9px") тоже ловится', () => {
    const res = runGate('check-tiny-fonts.mjs', {
      'scripts/tiny-fonts-baseline.json': JSON.stringify({}),
      'webapp/src/str.tsx': "const a = { fontSize: '9px' };\n",
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('fontSize: 9');
  });

  it('нет бейслайна — понятная ошибка, exit 1', () => {
    const res = runGate('check-tiny-fonts.mjs', {
      'webapp/src/clean.tsx': 'const a = { fontSize: 15 };\n',
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('Нет бейслайна');
  });

  it('--update пишет отсортированный бейслайн', () => {
    const res = runGate(
      'check-tiny-fonts.mjs',
      {
        'webapp/src/z.tsx': 'const a = { fontSize: 8 };\n',
        'webapp/src/a.tsx': 'const a = { fontSize: 9 };\n',
      },
      { args: ['--update'], keepTmp: true },
    );
    expect(res.status).toBe(0);
    const written = JSON.parse(
      readFileSync(join(res.tmp, 'scripts/tiny-fonts-baseline.json'), 'utf8'),
    );
    expect(Object.keys(written)).toEqual([
      'webapp/src/a.tsx',
      'webapp/src/z.tsx',
    ]);
    cleanupTmp(res.tmp);
  });

  it('вне SCAN_DIRS (например src/) не сканируется', () => {
    const res = runGate('check-tiny-fonts.mjs', {
      'scripts/tiny-fonts-baseline.json': JSON.stringify({}),
      'src/some-backend-file.ts': 'const style = { fontSize: 5 };\n',
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain(
      '✓ Храповик подпороговых fontSize: 0 (без роста)',
    );
  });
});
