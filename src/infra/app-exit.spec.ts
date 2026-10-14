// deploy/app-exit.mjs — решение супервизора «перезапускать ли приложение».
// Шов (настоящий entrypoint, ребёнок убивает себя сигналом) держит
// maintenance-startup.spec.ts; здесь — каждая ветка решения напрямую, в том
// числе code=0 вместе с сигналом: run() отдаёт именно так убитого ребёнка, и
// без проверки signal он сошёл бы за чистый выход (аудит 2026-10-11, r2-3#0).
import { execFileSync } from 'child_process';
import { join } from 'path';

const MODULE = join(__dirname, '..', '..', 'deploy', 'app-exit.mjs');

/** Зовёт экспорт настоящего .mjs отдельным node — jest ESM не грузит. */
function call(fn: string, args: unknown[]): unknown {
  const src = `import * as m from ${JSON.stringify(MODULE)};
process.stdout.write(JSON.stringify(m[${JSON.stringify(fn)}](...${JSON.stringify(args)})));`;
  const out = execFileSync(process.execPath, [
    '--input-type=module',
    '-e',
    src,
  ]);
  return JSON.parse(out.toString());
}

describe('deploy/app-exit.mjs', () => {
  it.each([
    [{ code: 0, signal: null }, true, 'stop'],
    [{ code: 0, signal: 'SIGTERM' }, true, 'stop'],
    [{ code: 0, signal: null }, false, 'clean'],
    [{ code: 1, signal: null }, false, 'crash'],
    [{ code: 0, signal: 'SIGKILL' }, false, 'crash'],
    [{ code: 0, signal: 'SIGABRT' }, false, 'crash'],
    [{ code: 0, signal: 'SIGTERM' }, false, 'crash'],
  ])('classifyAppExit(%j, shuttingDown=%s) → %s', (app, shuttingDown, want) => {
    expect(call('classifyAppExit', [app, shuttingDown])).toBe(want);
  });

  it('crashMessage называет сигнал, если ребёнка убили', () => {
    expect(
      call('crashMessage', [{ code: 0, signal: 'SIGABRT' }, 1500, 2, 3]),
    ).toBe(
      '[entrypoint] приложение убито сигналом SIGABRT (ranMs=1500, fails=2/3)',
    );
  });

  it('crashMessage называет код, если приложение упало само', () => {
    expect(call('crashMessage', [{ code: 7, signal: null }, 10, 1, 3])).toBe(
      '[entrypoint] приложение упало (code=7, ranMs=10, fails=1/3)',
    );
  });
});
