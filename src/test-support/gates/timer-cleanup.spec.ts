// Тест гейта check-timer-cleanup.mjs: таймер, ставящий состояние, чистится при
// размонтировании (clearTimeout или useTimedFlag), иначе — запись с причиной.
// Класс: тост пережил jsdom и уронил весь vitest «window is not defined»
// (CI main, run 36409902702).
import { spawnSync } from 'child_process';
import { join } from 'path';
import { runGate } from './gate-sandbox';

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

describe('check-timer-cleanup.mjs', () => {
  it('настоящее дерево — зелёный', () => {
    const res = spawnSync('node', ['scripts/check-timer-cleanup.mjs'], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    expect(res.stderr).toBe('');
    expect(res.status).toBe(0);
  });

  it('тост setTimeout(() => setX(false)) без очистки — красный, webapp и shared', () => {
    const res = run({
      'webapp/src/Toast.tsx': TOAST,
      'shared/src/hooks/useToast.ts': TOAST,
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('webapp/src/Toast.tsx (L3)');
    expect(res.stderr).toContain('shared/src/hooks/useToast.ts (L3)');
  });

  it('clearTimeout (вызов или ссылка) и useTimedFlag — зелёный', () => {
    const cleared = `${TOAST}\nuseEffect(() => () => clearTimeout(t.current), []);`;
    const byRef = `${TOAST}\nconst stop = () => timers.forEach(clearTimeout);`;
    const timed =
      TOAST.replace('setTimeout(() => setShown(false), 2000)', 'flash()') +
      '\nconst [on, flash] = useTimedFlag(2000);\nsetTimeout(() => setOther(1), 5);';
    expect(
      run({
        'webapp/src/A.tsx': cleared,
        'webapp/src/B.tsx': byRef,
        'webapp/src/C.tsx': timed,
      }).status,
    ).toBe(0);
  });

  it('контроль: таймер без сеттера состояния, clearTimeout в комментарии, тесты', () => {
    const noState =
      "setTimeout(() => window.dispatchEvent(new Event('x')), 40);";
    const commented = `${TOAST}\n// clearTimeout не нужен?`;
    const ok = run({
      'webapp/src/D.tsx': noState,
      'webapp/src/E.test.tsx': TOAST,
    });
    expect(ok.status).toBe(0);
    const bad = run({ 'webapp/src/F.tsx': commented });
    expect(bad.status).toBe(1);
  });

  it('бейслайн гасит с причиной; протухшая и короткая причина — красный', () => {
    const files = { 'webapp/src/Toast.tsx': TOAST };
    expect(
      run(files, {
        'webapp/src/Toast.tsx': 'стор сторонней библиотеки, не setState',
      }).status,
    ).toBe(0);
    expect(run(files, { 'webapp/src/Toast.tsx': 'ок' }).stderr).toContain(
      'короче 20 символов',
    );
    const stale = run(
      { 'webapp/src/G.tsx': 'export {};' },
      { 'webapp/src/G.tsx': 'раньше был тост без очистки' },
    );
    expect(stale.stderr).toContain('запись протухла');
  });
});
