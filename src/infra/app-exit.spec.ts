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

  // Пауза между сериями запусков (аудит 2026-10-11, infra#13): растёт ×2 и
  // упирается в потолок — иначе затяжная авария слала бы DM «Деплой завершён»
  // каждые base миллисекунд, а потолок без роста не гасил бы шторм вовсе.
  it.each([
    [0, 300000, 3600000, 300000],
    [1, 300000, 3600000, 600000],
    [2, 300000, 3600000, 1200000],
    [3, 300000, 3600000, 2400000],
    [4, 300000, 3600000, 3600000], // 4800000 → потолок
    [50, 300000, 3600000, 3600000], // 2 ** 50 не уходит в бесконечность
    [0, 200, 100, 200], // потолок ниже базы → не короче базы
    [-1, 300000, 3600000, 300000],
    [3, 0, 3600000, 0], // 0 отключает паузу (аварийный режим для тестов)
  ])('cooldownMs(round=%s, base=%s, max=%s) → %s', (r, base, max, want) => {
    expect(call('cooldownMs', [r, base, max])).toBe(want);
  });

  it.each([
    [
      'limit',
      300000,
      'лимит перезапусков исчерпан — техработы, следующая серия через 5 мин',
    ],
    [
      'db',
      3600000,
      'БД не поднялась в отведённое время — техработы, следующая серия через 60 мин',
    ],
    [
      'limit',
      2500,
      'лимит перезапусков исчерпан — техработы, следующая серия через 3 с',
    ],
    [
      'limit',
      200,
      'лимит перезапусков исчерпан — техработы, следующая серия через 200 мс',
    ],
  ])('cooldownMessage(%s, %s)', (reason, ms, tail) => {
    expect(call('cooldownMessage', [reason, ms])).toBe(`[entrypoint] ${tail}`);
  });

  describe('superviseSeries', () => {
    function drive(
      results: Array<{ reason: 'limit' | 'db'; healthy: boolean } | undefined>,
      opts: { stopAfterSleeps?: number } = {},
    ) {
      // jest ESM не грузит — гоним настоящий модуль отдельным node.
      const src = `import { superviseSeries } from ${JSON.stringify(MODULE)};
const queue = ${JSON.stringify(results)}.map((r) => r ?? undefined);
const sleeps = [];
const logs = [];
await superviseSeries(async () => queue.shift(), {
  base: 100,
  max: 350,
  stopping: () => sleeps.length >= ${opts.stopAfterSleeps ?? 'Infinity'},
  sleep: async (ms) => void sleeps.push(ms),
  log: (m) => logs.push(m),
});
process.stdout.write(JSON.stringify({ sleeps, logs, left: queue.length }));`;
      const out = execFileSync(process.execPath, [
        '--input-type=module',
        '-e',
        src,
      ]);
      return JSON.parse(out.toString()) as {
        sleeps: number[];
        logs: string[];
        left: number;
      };
    }

    it('серии подряд: пауза растёт до потолка, каждая — со строкой в лог', async () => {
      const r = drive([
        { reason: 'limit', healthy: false },
        { reason: 'db', healthy: false },
        { reason: 'limit', healthy: false },
        { reason: 'limit', healthy: false },
        undefined,
      ]);
      expect(r.sleeps).toEqual([100, 200, 350, 350]);
      expect(r.logs).toHaveLength(4);
      expect(r.logs[1]).toContain('БД не поднялась');
      expect(r.left).toBe(0);
    });

    it('серия с «здоровым» прогоном сбрасывает рост паузы', async () => {
      const r = drive([
        { reason: 'limit', healthy: false },
        { reason: 'limit', healthy: false },
        { reason: 'limit', healthy: true },
        { reason: 'limit', healthy: false },
        undefined,
      ]);
      expect(r.sleeps).toEqual([100, 200, 100, 200]);
    });

    it('undefined (остановка, чистый выход, парковка по migrate) → без паузы и новой серии', async () => {
      const r = drive([undefined, { reason: 'limit', healthy: false }]);
      expect(r.sleeps).toEqual([]);
      expect(r.left).toBe(1);
    });

    it('SIGTERM во время паузы → новая серия не начинается', async () => {
      const r = drive(
        [
          { reason: 'limit', healthy: false },
          { reason: 'limit', healthy: false },
        ],
        { stopAfterSleeps: 1 },
      );
      expect(r.sleeps).toEqual([100]);
      expect(r.left).toBe(1);
    });
  });
});
