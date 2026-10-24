// Тест гейта check-scale-drift.mjs (дизайн-аудит 2026-08, В11, волна
// «порядок»): пофайловый храповик инлайновых borderRadius/padding/margin/
// gap ВНЕ шкалы токенов (shared/src/theme/tokens.css, --r-*/--space-*).
// Проверяет оба исхода — гейт краснеет на регрессе и зеленеет на чистом
// дереве (правило «Тестовые храповики и e2e» CLAUDE.md).
import { readFileSync } from 'fs';
import { join } from 'path';
import { runGate, cleanupTmp } from './gate-sandbox';

describe('check-scale-drift.mjs', () => {
  it('новый файл со значением вне шкалы — exit 1', () => {
    const res = runGate('check-scale-drift.mjs', {
      'scripts/scale-drift-baseline.json': JSON.stringify({}),
      'webapp/src/foo.tsx':
        'export const x = <div style={{ borderRadius: 15 }} />;\n',
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      'webapp/src/foo.tsx: новый файл с 1 значениями вне шкалы',
    );
    expect(res.stderr).toContain('borderRadius: 15');
  });

  it('значения ИЗ шкалы не считаются (radius и space)', () => {
    const res = runGate('check-scale-drift.mjs', {
      'scripts/scale-drift-baseline.json': JSON.stringify({}),
      'webapp/src/clean.tsx': [
        'const a = { borderRadius: 14, gap: 8, marginBottom: 12 };',
        'const b = { padding: 24, paddingTop: 4 };',
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain(
      '✓ Храповик значений вне шкалы: 0 (без роста)',
    );
  });

  it('рост счётчика в известном файле — exit 1 с "было → стало"', () => {
    const res = runGate('check-scale-drift.mjs', {
      'scripts/scale-drift-baseline.json': JSON.stringify({
        'schema-miniapp/src/known.tsx': 1,
      }),
      'schema-miniapp/src/known.tsx': [
        'const a = { gap: 7 };',
        'const b = { gap: 9 };',
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('schema-miniapp/src/known.tsx: 1 → 2');
  });

  it('снижение счётчика — exit 0, предлагает зафиксировать --update', () => {
    const res = runGate('check-scale-drift.mjs', {
      'scripts/scale-drift-baseline.json': JSON.stringify({
        'shared/src/known.tsx': 2,
      }),
      'shared/src/known.tsx': 'const a = { gap: 7 };\n',
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('1 < 2 — стало лучше');
  });

  it('0 и отрицательные margin (bleed) не считаются дрейфом', () => {
    const res = runGate('check-scale-drift.mjs', {
      'scripts/scale-drift-baseline.json': JSON.stringify({}),
      'webapp/src/clean.tsx': [
        'const a = { padding: 0, borderRadius: 0 };',
        'const b = { marginTop: -14, marginLeft: -3 };',
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain(
      '✓ Храповик значений вне шкалы: 0 (без роста)',
    );
  });

  it('«полностью круглое» (100/999/9999) не считается дрейфом радиуса', () => {
    const res = runGate('check-scale-drift.mjs', {
      'scripts/scale-drift-baseline.json': JSON.stringify({}),
      'webapp/src/pill.tsx': [
        'const a = { borderRadius: 999 };',
        'const b = { borderRadius: 100 };',
        'const c = { borderRadius: 9999 };',
        "const d = { borderRadius: '50%' };",
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain(
      '✓ Храповик значений вне шкалы: 0 (без роста)',
    );
  });

  it('составные значения (строка с несколькими числами) не разбираются', () => {
    const res = runGate('check-scale-drift.mjs', {
      'scripts/scale-drift-baseline.json': JSON.stringify({}),
      'webapp/src/compound.tsx':
        "const a = { padding: '13px 17px', borderRadius: '13px 17px 0 0' };\n",
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain(
      '✓ Храповик значений вне шкалы: 0 (без роста)',
    );
  });

  it('нет бейслайна — понятная ошибка, exit 1', () => {
    const res = runGate('check-scale-drift.mjs', {
      'webapp/src/clean.tsx': 'const a = { gap: 8 };\n',
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('Нет бейслайна');
  });

  it('--update пишет отсортированный бейслайн', () => {
    const res = runGate(
      'check-scale-drift.mjs',
      {
        'webapp/src/z.tsx': 'const a = { gap: 7 };\n',
        'webapp/src/a.tsx': 'const a = { gap: 9 };\n',
      },
      { args: ['--update'], keepTmp: true },
    );
    expect(res.status).toBe(0);
    const written = JSON.parse(
      readFileSync(join(res.tmp, 'scripts/scale-drift-baseline.json'), 'utf8'),
    );
    expect(Object.keys(written)).toEqual([
      'webapp/src/a.tsx',
      'webapp/src/z.tsx',
    ]);
    cleanupTmp(res.tmp);
  });

  it('вне SCAN_DIRS (например src/) не сканируется', () => {
    const res = runGate('check-scale-drift.mjs', {
      'scripts/scale-drift-baseline.json': JSON.stringify({}),
      'src/some-backend-file.ts': 'const style = { gap: 7 };\n',
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain(
      '✓ Храповик значений вне шкалы: 0 (без роста)',
    );
  });
});
