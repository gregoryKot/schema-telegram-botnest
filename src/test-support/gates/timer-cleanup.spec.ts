// Тест гейта check-timer-cleanup.mjs: каждый таймер, меняющий состояние, держит
// id и снимает его clearTimeout в очистке, иначе — запись «файл::функция::что меняет»
// со счётом таймеров и причиной.
// Класс: тост пережил jsdom и уронил весь vitest «window is not defined»
// (CI main, run 36409902702).
import { spawnSync } from 'child_process';
import { join } from 'path';
import { readFileSync } from 'fs';
import { cleanupTmp, runGate } from './gate-sandbox';
import { importExport } from './pattern-loader';

const ROOT = join(__dirname, '..', '..', '..');
const TOAST = [
  'export function Toast() {',
  '  const [shown, setShown] = useState(false);',
  '  const show = () => { setShown(true); setTimeout(() => setShown(false), 2000); };',
  '  return null;',
  '}',
].join('\n');
type Baseline = Record<string, { count: number; reason: string } | string>;
const run = (
  files: Record<string, string>,
  baseline: Baseline = {},
  options: Parameters<typeof runGate>[2] = {},
) =>
  runGate(
    'check-timer-cleanup.mjs',
    {
      ...files,
      'scripts/timer-cleanup-baseline.json': JSON.stringify(baseline),
    },
    options,
  );
const REASON = 'стор сторонней библиотеки, не setState';
const entry = (count: number, reason = REASON) => ({ count, reason });
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

  it('uncleanedTimers (timer-cleanup-rules.mjs): строка, функция и что меняет, по порядку таймеров', () => {
    const src = [
      'const t = useRef(0);',
      'useEffect(() => () => clearTimeout(t.current), []);',
      't.current = setTimeout(() => setShown(false), 2000);',
      'setTimeout(() => setHint(null), 3000); setTimeout(onDone, 10);',
      'export function Card() {',
      '  useEffect(() => { setTimeout(() => setOpen(false), 5); }, []);',
      '  const close = useCallback(() => { setTimeout(() => setOpen(true), 5); }, []);',
      '}',
    ].join('\n');
    const found: unknown = JSON.parse(
      importExport(
        'timer-cleanup-rules.mjs',
        'uncleanedTimers',
        `(fn) => fn(${JSON.stringify(src)})`,
      ),
    );
    expect(found).toEqual([
      { line: 4, fn: '', change: 'setHint' },
      { line: 4, fn: '', change: 'onDone' },
      { line: 6, fn: 'Card', change: 'setOpen' },
      { line: 7, fn: 'close', change: 'setOpen' },
    ]);
  });

  it('тост setTimeout(() => setX(false)) без очистки — красный, webapp и shared', () => {
    const res = run({
      'webapp/src/Toast.tsx': TOAST,
      'shared/src/hooks/useToast.ts': TOAST,
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('webapp/src/Toast.tsx::show::setShown (L3)');
    expect(res.stderr).toContain(
      'shared/src/hooks/useToast.ts::show::setShown (L3)',
    );
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
      'webapp/src/A.tsx::show::setHint',
      'webapp/src/B.tsx::(модуль)::setStep',
    ]);
    expect(res.stderr).toContain('webapp/src/B.tsx::(модуль)::setStep (L3)');
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
      'webapp/src/A.tsx::finish::onDone',
      'webapp/src/B.tsx::(модуль)::props.onClose',
      'webapp/src/C.tsx::(модуль)::dispatch',
      'webapp/src/D.tsx::(модуль)::onSaveRef.current',
      'webapp/src/E.tsx::(модуль)::hide',
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
      'webapp/src/A.tsx::arm::setSaved',
      'webapp/src/B.tsx::start::onLongPress',
      'webapp/src/C.tsx::(модуль)::setOther',
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

  it('бейслайн гасит запись «файл::функция::что меняет» с причиной; протухшая и короткая причина — красный', () => {
    const files = { 'webapp/src/Toast.tsx': TOAST };
    const key = 'webapp/src/Toast.tsx::show::setShown';
    expect(run(files, { [key]: entry(1) }).status).toBe(0);
    expect(run(files, { [key]: entry(1, 'ок') }).stderr).toContain(
      'короче 20 символов',
    );
    const stale = run(
      { 'webapp/src/G.tsx': 'export {};' },
      { 'webapp/src/G.tsx::show::setShown': entry(1) },
    );
    expect(stale.stderr).toContain('запись протухла');
    const otherSetter = run(
      {
        'webapp/src/Toast.tsx': TOAST.replace(
          'setShown(false)',
          'setShown(false); setTimeout(() => setHint(null), 10)',
        ),
      },
      { [key]: entry(1) },
    );
    expect(keysIn(otherSetter.stderr)).toEqual([
      'webapp/src/Toast.tsx::show::setHint',
    ]);
  });

  // Ключ без позиции: запись «файл::что меняет» молча покрывала второй такой же
  // таймер в файле, если первый починили (К24, #1272). Теперь счёт по функции.
  describe('счёт таймеров по функции', () => {
    const key = 'webapp/src/Toast.tsx::show::setShown';
    const twice = {
      'webapp/src/Toast.tsx': TOAST.replace(
        '2000); };',
        '2000); setTimeout(() => setShown(true), 10); };',
      ),
    };
    const otherFn = {
      'webapp/src/Toast.tsx': `${TOAST}\nconst hide = () => { setTimeout(() => setShown(false), 10); };`,
    };

    it('второй таймер в той же функции при count 1 — красный, обе строки в выводе', () => {
      const res = run(twice, { [key]: entry(1) });
      expect(res.status).toBe(1);
      expect(res.stderr).toContain(
        `${key} (L3, L3): таймеров без очистки 2, в бейслайне 1`,
      );
    });

    it('тот же счёт — зелёный', () => {
      const res = run(twice, { [key]: entry(2) });
      expect(res.stderr).toBe('');
      expect(res.status).toBe(0);
    });

    it('таймер с тем же сеттером в другой функции — красный, свой ключ', () => {
      const res = run(otherFn, { [key]: entry(1) });
      expect(res.status).toBe(1);
      expect(keysIn(res.stderr)).toEqual([
        'webapp/src/Toast.tsx::hide::setShown',
      ]);
    });

    it('запись больше факта — красный с подсказкой уменьшить через --update', () => {
      const res = run({ 'webapp/src/Toast.tsx': TOAST }, { [key]: entry(2) });
      expect(res.status).toBe(1);
      expect(res.stderr).toContain(
        `бейслайн ${key}: в бейслайне 2, без очистки 1 — уменьши`,
      );
      expect(res.stderr).toContain('--update');
    });

    it('count не целое положительное — красный', () => {
      const res = run({ 'webapp/src/Toast.tsx': TOAST }, { [key]: entry(0) });
      expect(res.stderr).toContain('count — целое не меньше 1');
    });
  });

  describe('--update', () => {
    const update = (files: Record<string, string>, baseline: Baseline) => {
      const res = run(files, baseline, { args: ['--update'], keepTmp: true });
      try {
        const written = readFileSync(
          join(res.tmp, 'scripts/timer-cleanup-baseline.json'),
          'utf8',
        );
        return { ...res, written: JSON.parse(written) as Baseline };
      } finally {
        cleanupTmp(res.tmp);
      }
    };

    it('переносит старый ключ «файл::что меняет»(#2) с причиной и счётом; без --update он красный', () => {
      const twice = {
        'webapp/src/Toast.tsx': `${TOAST}\nconst hide = () => { setTimeout(() => setShown(false), 10); };`,
      };
      const legacy = {
        'webapp/src/Toast.tsx::setShown': REASON,
        'webapp/src/Toast.tsx::setShown#2': 'другая причина второго таймера',
      };
      expect(run(twice, legacy).stderr).toContain('ключ старого формата');
      const res = update(twice, legacy);
      expect(res.status).toBe(0);
      expect(res.written).toEqual({
        'webapp/src/Toast.tsx::hide::setShown': entry(1),
        'webapp/src/Toast.tsx::show::setShown': entry(1),
      });
    });

    it('уменьшает счёт до факта и снимает протухшее, но не добавляет новое и не растит счёт', () => {
      const key = 'webapp/src/Toast.tsx::show::setShown';
      const lowered = update(
        { 'webapp/src/Toast.tsx': TOAST },
        { [key]: entry(3), 'webapp/src/G.tsx::f::setX': entry(1) },
      );
      expect(lowered.written).toEqual({ [key]: entry(1) });
      expect(lowered.status).toBe(0);
      const grown = update(
        {
          'webapp/src/Toast.tsx': TOAST.replace(
            '2000); };',
            '2000); setTimeout(() => setShown(true), 10); };',
          ),
          'webapp/src/New.tsx': TOAST,
        },
        { [key]: entry(1) },
      );
      expect(grown.written).toEqual({ [key]: entry(1) });
      expect(grown.status).toBe(1);
    });
  });

  it('скрытый каталог не обходится', () => {
    const res = run({ 'webapp/src/.cache/Toast.tsx': TOAST });
    expect(res.stderr).toBe('');
    expect(res.status).toBe(0);
  });

  it('колбэк зовёт свою функцию, меняющую состояние: без очистки — красный, с очисткой и фабрика — зелёный', () => {
    const tick = 'const tick = () => { setState(1); };\n';
    const bad = `${tick}const go = () => { setTimeout(() => void tick(), 100); };`;
    const good = [
      tick,
      'const timer = useRef(0);',
      'useEffect(() => () => clearTimeout(timer.current), []);',
      'timer.current = setTimeout(() => void tick(), 100);',
    ].join('\n');
    const factory = [
      'function make() {',
      '  let timer = null;',
      '  const take = () => { if (timer) clearTimeout(timer); timer = null; };',
      '  const send = () => { take(); onLeaveError(1); };',
      '  return { go: () => { timer = setTimeout(() => send(), 100); }, leave: send };',
      '}',
    ].join('\n');
    const res = run({
      'webapp/src/A.tsx': bad,
      'webapp/src/B.tsx': good,
      'shared/src/C.ts': factory,
    });
    expect(res.status).toBe(1);
    expect(keysIn(res.stderr)).toEqual(['webapp/src/A.tsx::go::tick']);
  });

  it('очистка на два вызова от возвращённой функции — зелёный; никем не зовущий помощник — красный', () => {
    const chain = [
      'const t = useRef(0);',
      'const clear = () => clearTimeout(t.current);',
      'const stop = () => { clear(); };',
      'useEffect(() => () => { stop(); }, []);',
      't.current = setTimeout(() => setShown(false), 100);',
    ].join('\n');
    const orphan = [
      'const t = useRef(0);',
      'const clear = () => clearTimeout(t.current);',
      't.current = setTimeout(() => setShown(false), 100);',
    ].join('\n');
    const res = run({ 'webapp/src/A.tsx': chain, 'webapp/src/B.tsx': orphan });
    expect(res.status).toBe(1);
    expect(keysIn(res.stderr)).toEqual([
      'webapp/src/B.tsx::(модуль)::setShown',
    ]);
  });

  it('класс: this.setState без componentWillUnmount — красный, с ним — зелёный', () => {
    const cls = (unmount: string) =>
      [
        'class A extends Component {',
        '  timer = 0;',
        '  show() { this.timer = setTimeout(() => this.setState({ shown: false }), 100); }',
        unmount,
        '}',
      ].join('\n');
    const res = run({
      'webapp/src/Bad.tsx': cls(''),
      'webapp/src/Good.tsx': cls(
        '  componentWillUnmount() { clearTimeout(this.timer); }',
      ),
    });
    expect(res.status).toBe(1);
    expect(keysIn(res.stderr)).toEqual([
      'webapp/src/Bad.tsx::show::this.setState',
    ]);
  });
});
