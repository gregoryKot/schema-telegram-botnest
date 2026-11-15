// Тест гейта check-timer-cleanup.mjs: каждый таймер, меняющий состояние, держит
// id и снимает его clearTimeout в очистке, иначе — запись «файл::что меняет» с причиной.
// Класс: тост пережил jsdom и уронил весь vitest «window is not defined»
// (CI main, run 36409902702).
import { spawnSync } from 'child_process';
import { join } from 'path';
import { runGate } from './gate-sandbox';
import { importExport } from './pattern-loader';

const ROOT = join(__dirname, '..', '..', '..');
const TOAST = [
  'export function Toast() {',
  '  const [shown, setShown] = useState(false);',
  '  const show = () => { setShown(true); setTimeout(() => setShown(false), 2000); };',
  '  return null;',
  '}',
].join('\n');
const run = (
  files: Record<string, string>,
  baseline: Record<string, string> = {},
) =>
  runGate('check-timer-cleanup.mjs', {
    ...files,
    'scripts/timer-cleanup-baseline.json': JSON.stringify(baseline),
  });
const keysIn = (stderr: string) =>
  [...stderr.matchAll(/(\S+::\S+) \(L/g)].map((m) => m[1]).sort();

describe('check-timer-cleanup.mjs', () => {
  it('настоящее дерево — зелёный', () => {
    const res = spawnSync('node', ['scripts/check-timer-cleanup.mjs'], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    expect(res.stderr).toBe('');
    expect(res.status).toBe(0);
  });

  it('uncleanedTimers (timer-cleanup-rules.mjs): строка и что меняет, по порядку таймеров', () => {
    const src = [
      'const t = useRef(0);',
      'useEffect(() => () => clearTimeout(t.current), []);',
      't.current = setTimeout(() => setShown(false), 2000);',
      'setTimeout(() => setHint(null), 3000); setTimeout(onDone, 10);',
    ].join('\n');
    const found: unknown = JSON.parse(
      importExport(
        'timer-cleanup-rules.mjs',
        'uncleanedTimers',
        `(fn) => fn(${JSON.stringify(src)})`,
      ),
    );
    expect(found).toEqual([
      { line: 4, change: 'setHint' },
      { line: 4, change: 'onDone' },
    ]);
  });

  it('тост setTimeout(() => setX(false)) без очистки — красный, webapp и shared', () => {
    const res = run({
      'webapp/src/Toast.tsx': TOAST,
      'shared/src/hooks/useToast.ts': TOAST,
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('webapp/src/Toast.tsx::setShown (L3)');
    expect(res.stderr).toContain('shared/src/hooks/useToast.ts::setShown (L3)');
  });

  it('два таймера и один clearTimeout — красный второй таймер', () => {
    const refAndBare = [
      'const t = useRef(0);',
      'useEffect(() => () => clearTimeout(t.current), []);',
      'const show = () => {',
      '  t.current = setTimeout(() => setShown(false), 2000);',
      '  setTimeout(() => setHint(null), 3000);',
      '};',
    ].join('\n');
    const twoIds = [
      'useEffect(() => {',
      '  const a = setTimeout(() => setStep(1), 100);',
      '  const b = setTimeout(() => setStep(2), 200);',
      '  return () => clearTimeout(a);',
      '}, []);',
    ].join('\n');
    const res = run({
      'webapp/src/A.tsx': refAndBare,
      'webapp/src/B.tsx': twoIds,
    });
    expect(res.status).toBe(1);
    expect(keysIn(res.stderr)).toEqual([
      'webapp/src/A.tsx::setHint',
      'webapp/src/B.tsx::setStep',
    ]);
    expect(res.stderr).toContain('webapp/src/B.tsx::setStep (L3)');
  });

  it('колбэк-проп, dispatch и своя функция без очистки — красный', () => {
    const res = run({
      'webapp/src/A.tsx':
        'const finish = () => { setTimeout(() => onDone(), 300); };',
      'webapp/src/B.tsx': 'setTimeout(props.onClose, 300);',
      'webapp/src/C.tsx': "setTimeout(() => dispatch({ type: 'hide' }), 300);",
      'webapp/src/D.tsx': 'setTimeout(() => onSaveRef.current?.(ids), 300);',
      'webapp/src/E.tsx':
        'const hide = () => setShown(false);\nsetTimeout(hide, 300);',
    });
    expect(res.status).toBe(1);
    expect(keysIn(res.stderr)).toEqual([
      'webapp/src/A.tsx::onDone',
      'webapp/src/B.tsx::props.onClose',
      'webapp/src/C.tsx::dispatch',
      'webapp/src/D.tsx::onSaveRef.current',
      'webapp/src/E.tsx::hide',
    ]);
  });

  it('своя очистка у каждого таймера — зелёный', () => {
    const files = {
      'webapp/src/Local.tsx':
        'useEffect(() => { const t = setTimeout(() => setX(1), 100); return () => clearTimeout(t); }, []);',
      'webapp/src/Ref.tsx':
        'useEffect(() => () => clearTimeout(t.current), []);\nconst arm = () => { t.current = window.setTimeout(() => setY(false), 100); };',
      'webapp/src/Named.tsx': [
        'const stop = useCallback(() => { if (t.current) clearTimeout(t.current); }, []);',
        'useEffect(() => stop, [stop]);',
        'const tap = () => { stop(); t.current = setTimeout(() => setPendingId(null), 100); };',
      ].join('\n'),
      'webapp/src/Called.tsx':
        'function cancel() { clearTimeout(hold.current); }\nuseEffect(() => () => cancel(), []);\nhold.current = setTimeout(() => onLongPress(), 450);',
      'webapp/src/Map.tsx':
        'useEffect(() => {\n  const timers = DELAYS.map((ms) =>\n    setTimeout(() => setId(read()), ms),\n  );\n  return () => timers.forEach(clearTimeout);\n}, []);',
      'webapp/src/Alias.tsx': [
        'useEffect(() => {',
        '  const t = timers.current;',
        '  return () => { Object.values(t).forEach(clearTimeout); };',
        '}, []);',
        'const save = (id) => { timers.current[id] = setTimeout(() => { setSaved(id); }, 100); };',
      ].join('\n'),
      'webapp/src/Push.tsx':
        'useEffect(() => {\n  const timers = [];\n  timers.push(setTimeout(() => setStep(2), 50));\n  return () => { for (const x of timers) clearTimeout(x); };\n}, []);',
    };
    const res = run(files);
    expect(res.stderr).toBe('');
    expect(res.status).toBe(0);
  });

  it('clearTimeout не в очистке и useTimedFlag по соседству не прикрывают таймер — красный', () => {
    const debounceOnly = [
      'const arm = () => {',
      '  if (t.current) clearTimeout(t.current);',
      '  t.current = setTimeout(() => setSaved(false), 1500);',
      '};',
    ].join('\n');
    const handlerOnly =
      'const cancel = () => clearTimeout(t.current);\nconst start = () => { t.current = setTimeout(() => onLongPress(), 450); };\nreturn { onPointerUp: cancel };';
    const timedNeighbour = `${TOAST.replace('setTimeout(() => setShown(false), 2000)', 'flash()')}\nconst [on, flash] = useTimedFlag(2000);\nsetTimeout(() => setOther(1), 5);`;
    const res = run({
      'webapp/src/A.tsx': debounceOnly,
      'webapp/src/B.tsx': handlerOnly,
      'webapp/src/C.tsx': timedNeighbour,
    });
    expect(res.status).toBe(1);
    expect(keysIn(res.stderr)).toEqual([
      'webapp/src/A.tsx::setSaved',
      'webapp/src/B.tsx::onLongPress',
      'webapp/src/C.tsx::setOther',
    ]);
  });

  it('контроль: не состояние, useTimedFlag, тесты — зелёный; clearTimeout в комментарии — красный', () => {
    const notState = [
      "setTimeout(() => window.dispatchEvent(new Event('x')), 40);",
      "setTimeout(() => localStorage.setItem('k', 'v'), 40);",
      'setTimeout(() => inputRef.current?.focus(), 30);',
      "setTimeout(() => console.log('setX(1)'), 30);",
    ].join('\n');
    const timed = TOAST.replace(
      'setTimeout(() => setShown(false), 2000)',
      'flash()',
    );
    const ok = run({
      'webapp/src/D.tsx': notState,
      'webapp/src/T.tsx': `${timed}\nconst [on, flash] = useTimedFlag(2000);`,
      'webapp/src/E.test.tsx': TOAST,
    });
    expect(ok.stderr).toBe('');
    expect(ok.status).toBe(0);
    const commented = `${TOAST}\n// useEffect(() => () => clearTimeout(t), []);`;
    expect(run({ 'webapp/src/F.tsx': commented }).status).toBe(1);
  });

  it('бейслайн гасит запись «файл::что меняет» с причиной; протухшая и короткая причина — красный', () => {
    const files = { 'webapp/src/Toast.tsx': TOAST };
    const key = 'webapp/src/Toast.tsx::setShown';
    expect(
      run(files, { [key]: 'стор сторонней библиотеки, не setState' }).status,
    ).toBe(0);
    expect(run(files, { [key]: 'ок' }).stderr).toContain('короче 20 символов');
    const stale = run(
      { 'webapp/src/G.tsx': 'export {};' },
      { 'webapp/src/G.tsx::setShown': 'раньше был тост без очистки' },
    );
    expect(stale.stderr).toContain('запись протухла');
    const otherSetter = run(
      {
        'webapp/src/Toast.tsx': `${TOAST}\nsetTimeout(() => setHint(null), 10);`,
      },
      { [key]: 'стор сторонней библиотеки, не setState' },
    );
    expect(keysIn(otherSetter.stderr)).toEqual([
      'webapp/src/Toast.tsx::setHint',
    ]);
  });

  it('запись гасит один таймер: второй с тем же сеттером в файле — красный, ключ «…#2»', () => {
    const reason = 'стор сторонней библиотеки, не setState';
    const key = 'webapp/src/Toast.tsx::setShown';
    const twice = {
      'webapp/src/Toast.tsx': `${TOAST}\nsetTimeout(() => setShown(true), 10);`,
    };
    const second = run(twice, { [key]: reason });
    expect(second.status).toBe(1);
    expect(second.stderr).toContain(`${key}#2 (L6)`);
    expect(keysIn(second.stderr)).toEqual([`${key}#2`]);
    expect(run(twice, { [key]: reason, [`${key}#2`]: reason }).status).toBe(0);
  });
});
