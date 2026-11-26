// Тест гейта check-utility-inline.mjs: инлайновый style={{…}}, набор которого
// точно совпадает с классом-утилитой shared/src/theme/utilities.css, не растёт
// (docs/open/frontend-ux.md). Оба исхода и контрольные образцы: лишнее
// свойство, спред и вычисляемое значение — не механика, а решение.
import { runGate } from './gate-sandbox';

const GATE = 'check-utility-inline.mjs';
const UTIL = [
  '.u-ac8.u-ac8 { display: flex; align-items: center; gap: var(--space-8); }',
  '.u-mb4.u-mb4 { margin-bottom: var(--space-4); }',
  '.u-w600.u-w600 { font-weight: 600; }',
].join('\n');
const TOKENS = ':root { --space-4: 4px; --space-8: 8px; }';
const run = (tsx: string, baseline: Record<string, number> = {}) =>
  runGate(GATE, {
    'shared/src/theme/utilities.css': UTIL + '\n',
    'shared/src/theme/tokens.css': TOKENS + '\n',
    'webapp/src/A.tsx': tsx + '\n',
    'scripts/utility-inline-baseline.json': JSON.stringify(baseline),
  });

describe('check-utility-inline.mjs', () => {
  it('набор как у u-ac8 (число вместо токена) — красный с подсказкой класса', () => {
    const res = run(
      "<div style={{ display: 'flex', alignItems: 'center', gap: 8 }} />",
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('L1 → className="u-ac8"');
  });

  it('токен строкой и безразмерный font-weight — тоже совпадение', () => {
    const tsx = [
      "<p style={{ marginBottom: 'var(--space-4)' }} />",
      '<b style={{ fontWeight: 600 }} />',
    ].join('\n');
    const res = run(tsx);
    expect(res.stderr).toContain('u-mb4');
    expect(res.stderr).toContain('u-w600');
  });

  it.each([
    [
      'лишнее свойство',
      "<div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 4 }} />",
    ],
    ['спред', '<div style={{ ...base, marginBottom: 4 }} />'],
    ['выражение', '<div style={{ marginBottom: open ? 4 : 0 }} />'],
    ['другое значение', '<div style={{ marginBottom: 6 }} />'],
  ])('контроль: %s — не считается', (_n, tsx) => {
    expect(run(tsx).status).toBe(0);
  });

  it('файл в бейслайне со своим числом — зелёный; рост — красный', () => {
    const one = '<p style={{ marginBottom: 4 }} />';
    expect(run(one, { 'webapp/src/A.tsx': 1 }).status).toBe(0);
    const two = `${one}\n<b style={{ fontWeight: 600 }} />`;
    expect(run(two, { 'webapp/src/A.tsx': 1 }).status).toBe(1);
  });
});
