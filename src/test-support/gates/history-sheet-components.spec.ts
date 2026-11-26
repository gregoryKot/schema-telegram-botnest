// check-history-sheet.mjs судит оверлей по компоненту, а не по файлу: хук
// соседа не закрывает чек-ин без хука (форма находки аудита 2026-10), а
// компонент рисует не больше оверлеев, чем вызывает хук, — второй оверлей в
// том же компоненте требует записи с числом. Общие случаи — history-sheet.spec.ts.
import { runGate } from './gate-sandbox';
import { callExport, importExport } from './pattern-loader';

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

const SHEET_WITH_SUBSHEET = [
  'export function Sheet({ onClose }: { onClose: () => void }) {',
  '  const goBack = useHistorySheet(onClose);',
  '  const [more, setMore] = useState(false);',
  '  return (',
  "    <div style={{ position: 'fixed', inset: 0 }} onClick={goBack}>",
  '      {more && <BottomSheetShell goBack={() => setMore(false)}>ещё</BottomSheetShell>}',
  '    </div>',
  '  );',
  '}',
].join('\n');
const CHECKIN_TWO_BRANCHES = [
  'function Checkin({ ready, onClose }: { ready: boolean; onClose: () => void }) {',
  "  if (!ready) return <div style={{ position: 'fixed', inset: 0 }} />;",
  "  return <div style={{ position: 'fixed', inset: 0 }} onClick={onClose} />;",
  '}',
].join('\n');

describe('check-history-sheet.mjs — оверлеев в компоненте не больше, чем вызовов хука', () => {
  it('под-лист без своей записи в компоненте с хуком — красный, с числом', () => {
    const res = run(SHEET_WITH_SUBSHEET);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      'webapp/src/Screen.tsx › Sheet: оверлеев 2, а вызовов useHistorySheet 1',
    );
  });

  it('контроль: "overlays" с верным числом — зелёный, с неверным — красный', () => {
    const at = (n: number) => ({
      'webapp/src/Screen.tsx': entry({ overlays: { Sheet: n } }),
    });
    expect(run(SHEET_WITH_SUBSHEET, at(2)).status).toBe(0);
    const wrong = run(SHEET_WITH_SUBSHEET, at(3));
    expect(wrong.status).toBe(1);
    expect(wrong.stderr).toContain('в "overlays" 3, а оверлеев 2');
  });

  it('записанный компонент без хука: второй оверлей — красный, "overlays" с числом — зелёный', () => {
    const plain = run(CHECKIN_TWO_BRANCHES, {
      'webapp/src/Screen.tsx': entry(),
    });
    expect(plain.status).toBe(1);
    expect(plain.stderr).toContain(
      'Checkin: оверлеев 2, а запись закрывает один',
    );
    const counted = { overlays: { Checkin: 2 } };
    expect(
      run(CHECKIN_TWO_BRANCHES, { 'webapp/src/Screen.tsx': entry(counted) })
        .status,
    ).toBe(0);
  });

  it('"overlays" там, где хватает хука, или для чужого имени — протухшая запись', () => {
    const res = run(`${SHEET_WITH_HOOK}\n\n${CHECKIN_NO_HOOK}`, {
      'webapp/src/Screen.tsx': entry({ overlays: { Sheet: 1, Ghost: 2 } }),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('"overlays".Sheet: оверлеев 1');
    expect(res.stderr).toContain(
      '"overlays".Ghost: такого компонента-оверлея нет',
    );
  });
});

describe('history-sheet-detect.mjs — topLevelComponents', () => {
  type Comp = {
    name: string;
    start: number;
    end: number;
    hook: boolean;
    calls: number;
  };
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
    expect(comps(src)).toEqual([
      { name: 'A', start: 1, end: 5, hook: false, calls: 0 },
    ]);
  });
});

describe('history-sheet-judge.mjs — judgeFile', () => {
  type Verdict = { missing: string[]; problems: string[] };
  const judge = (comps: unknown[]) =>
    JSON.parse(
      importExport(
        'history-sheet-judge.mjs',
        'judgeFile',
        `(fn) => fn('F.tsx', ${JSON.stringify(comps)})`,
      ),
    ) as Verdict;
  const hit = (line: number) => ({ line, what: 'x' });

  it('без записи: компонент без хука — missing, лишний оверлей при хуке — problems; два хита одной строки — одна точка', () => {
    const got = judge([
      { name: 'A', calls: 0, hits: [hit(1)] },
      { name: 'B', calls: 1, hits: [hit(5), hit(9)] },
      { name: 'C', calls: 1, hits: [hit(12), hit(12)] },
    ]);
    expect(got.missing).toEqual(['   F.tsx › A  (L1: x)']);
    expect(got.problems).toHaveLength(1);
    expect(got.problems[0]).toContain(
      'F.tsx › B: оверлеев 2, а вызовов useHistorySheet 1',
    );
  });
});
