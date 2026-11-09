// check-history-sheet.mjs судит оверлей по компоненту, а не по файлу
// (docs/open/one-frontend.md, «Гейт оверлеев webapp — слепые зоны»). Раньше
// второй оверлей в файле, который уже вызывал хук или стоял в бейслайне,
// проходил мимо — ровно форма находки аудита 2026-10 с чек-ином без хука.
// Общие случаи гейта — history-sheet.spec.ts.
import { runGate } from './gate-sandbox';
import { callExport } from './pattern-loader';

const GATE = 'check-history-sheet.mjs';
const BASE = 'scripts/history-sheet-baseline.json';
const entry = (extra: Record<string, unknown> = {}) => ({
  reason: 'честная причина длиннее двадцати символов',
  since: 'abc1234',
  ...extra,
});

const SHEET_WITH_HOOK = [
  'export function Sheet({ onClose }: { onClose: () => void }) {',
  '  const goBack = useHistorySheet(onClose);',
  "  return <div style={{ position: 'fixed', inset: 0 }} onClick={goBack} />;",
  '}',
].join('\n');
const CHECKIN_NO_HOOK = [
  'function Checkin({ onClose }: { onClose: () => void }) {',
  "  return <div style={{ position: 'fixed', inset: 0 }} onClick={onClose} />;",
  '}',
].join('\n');
const CHECKIN_WITH_HOOK = CHECKIN_NO_HOOK.replace(
  '  return',
  '  const goBack = useHistorySheet(onClose);\n  return',
).replace('onClick={onClose}', 'onClick={goBack}');

const run = (src: string, baseline: Record<string, unknown> = {}) =>
  runGate(GATE, {
    'webapp/src/Screen.tsx': src + '\n',
    [BASE]: JSON.stringify(baseline),
  });

describe('check-history-sheet.mjs — решение по компоненту', () => {
  it('хук листа не закрывает чек-ин без хука в соседнем компоненте — красный', () => {
    const res = run(`${SHEET_WITH_HOOK}\n\n${CHECKIN_NO_HOOK}`);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('webapp/src/Screen.tsx › Checkin');
    expect(res.stderr).not.toContain('› Sheet');
  });

  it('контроль: хук в обоих компонентах — зелёный', () => {
    expect(run(`${SHEET_WITH_HOOK}\n\n${CHECKIN_WITH_HOOK}`).status).toBe(0);
  });

  it('файл из бейслайна: новый оверлей в другом компоненте — красный, перечень в components — зелёный', () => {
    const two = `${CHECKIN_NO_HOOK}\n\n${CHECKIN_NO_HOOK.replace('Checkin', 'Loader')}`;
    const one = run(two, { 'webapp/src/Screen.tsx': entry() });
    expect(one.status).toBe(1);
    expect(one.stderr).toContain('компонентов-оверлеев без хука 2');
    const listed = run(two, {
      'webapp/src/Screen.tsx': entry({ components: ['Checkin'] }),
    });
    expect(listed.status).toBe(1);
    expect(listed.stderr).toContain('webapp/src/Screen.tsx › Loader');
    const all = { components: ['Checkin', 'Loader'] };
    expect(run(two, { 'webapp/src/Screen.tsx': entry(all) }).status).toBe(0);
  });

  it('components с компонентом, получившим хук, — протухшая запись', () => {
    const src = `${SHEET_WITH_HOOK}\n\n${CHECKIN_NO_HOOK}`;
    const res = run(src, {
      'webapp/src/Screen.tsx': entry({ components: ['Checkin', 'Sheet'] }),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('в components Sheet');
  });

  it('одна запись на файл с хуком у листа закрывает единственный компонент без хука', () => {
    const src = `${SHEET_WITH_HOOK}\n\n${CHECKIN_NO_HOOK}`;
    expect(run(src, { 'webapp/src/Screen.tsx': entry() }).status).toBe(0);
  });
});

describe('history-sheet-detect.mjs — topLevelComponents', () => {
  type Comp = { name: string; start: number; end: number; hook: boolean };
  const comps = (src: string) =>
    callExport('history-sheet-detect.mjs', 'topLevelComponents', src) as Comp[];

  it('функции и const верхнего уровня, хук — только в своём теле', () => {
    const got = comps(
      `${SHEET_WITH_HOOK}\n\nexport const X = () => null;\n${CHECKIN_NO_HOOK}`,
    );
    expect(got.map((c) => [c.name, c.start, c.hook])).toEqual([
      ['Sheet', 1, true],
      ['X', 6, false],
      ['Checkin', 7, false],
    ]);
  });

  it('вложенная функция и хук в комментарии — не компонент и не хук', () => {
    const src = [
      'function A() {',
      '  function inner() {}',
      '  // useHistorySheet(onClose)',
      '  return null;',
      '}',
    ].join('\n');
    expect(comps(src)).toEqual([{ name: 'A', start: 1, end: 5, hook: false }]);
  });
});
