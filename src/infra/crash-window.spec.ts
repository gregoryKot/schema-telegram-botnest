// deploy/crash-window.mjs — счётчик падений в скользящих окнах и троттл DM о
// перезапуске (аудит 2026-10, «Супервизор контейнера»: прогон дольше минуты
// обнулял счётчик, и крашлуп с периодом 61 с не доходил до лимита никогда, а
// DM о старте уходил на каждом круге). Шов — настоящий entrypoint с настоящими
// процессами — держит maintenance-startup.spec.ts; здесь границы и сутки.
import { execFileSync } from 'child_process';
import { join } from 'path';

const MODULE = join(__dirname, '..', '..', 'deploy', 'crash-window.mjs');

/** Зовёт экспорт настоящего .mjs отдельным node — jest ESM не грузит. */
function call(fn: string, args: unknown[]): unknown {
  const src = `import * as m from ${JSON.stringify(MODULE)};
const r = m[${JSON.stringify(fn)}](...${JSON.stringify(args)});
process.stdout.write(JSON.stringify(r === undefined ? null : r));`;
  const out = execFileSync(process.execPath, [
    '--input-type=module',
    '-e',
    src,
  ]);
  return JSON.parse(out.toString());
}

describe('deploy/crash-window.mjs', () => {
  describe('crashesInWindow', () => {
    it('пустая история → только текущее падение', () => {
      expect(call('crashesInWindow', [[], 1000, 500])).toEqual([1000]);
    });

    it('падения старше окна отбрасываются, внутри окна — остаются', () => {
      expect(call('crashesInWindow', [[100, 600, 900], 1000, 500])).toEqual([
        600, 900, 1000,
      ]);
    });

    it('граница: ровно windowMs назад — уже вне окна', () => {
      expect(call('crashesInWindow', [[500, 501], 1000, 500])).toEqual([
        501, 1000,
      ]);
    });

    it('крашлуп «каждые 61 с» в окне 15 мин копит падения, а не обнуляет', () => {
      let times: number[] = [];
      for (let i = 1; i <= 3; i++) {
        times = call('crashesInWindow', [
          times,
          i * 61_000,
          900_000,
        ]) as number[];
      }
      expect(times).toHaveLength(3);
    });

    it('падение раз в 30 мин в окне 15 мин — всегда первое (не крашлуп)', () => {
      let times: number[] = [];
      for (let i = 1; i <= 3; i++) {
        times = call('crashesInWindow', [
          times,
          i * 1_800_000,
          900_000,
        ]) as number[];
      }
      expect(times).toEqual([5_400_000]);
    });
  });

  describe('positiveOr', () => {
    it.each([[undefined], [''], ['abc'], ['0'], ['-5'], ['Infinity']])(
      '%p → значение по умолчанию',
      (raw) => {
        expect(call('positiveOr', [raw, 900000])).toBe(900000);
      },
    );

    it.each([
      ['60000', 60000],
      ['100', 100],
    ])('%p → %d', (raw, want) => {
      expect(call('positiveOr', [raw, 900000])).toBe(want);
    });
  });
  describe('shouldNotice', () => {
    it.each([
      [0, true],
      [1, true],
      [2, true],
      [3, false],
      [4, true],
      [6, false],
      [8, true],
      [64, true],
    ])('%d падений за сутки, сообщений не было → %p', (k, want) => {
      expect(call('shouldNotice', [k, [], 1000, 500])).toBe(want);
    });

    it('об этом уровне или выше уже сообщали в окне → молчим', () => {
      expect(call('shouldNotice', [4, [{ at: 900, k: 4 }], 1000, 500])).toBe(
        false,
      );
      expect(call('shouldNotice', [4, [{ at: 900, k: 8 }], 1000, 500])).toBe(
        false,
      );
    });

    it('контроль: сообщение ниже уровня или старше окна не глушит', () => {
      expect(call('shouldNotice', [4, [{ at: 900, k: 2 }], 1000, 500])).toBe(
        true,
      );
      expect(call('shouldNotice', [4, [{ at: 500, k: 4 }], 1000, 500])).toBe(
        true,
      );
    });
  });

  describe('createCrashBook', () => {
    type Op = ['launch' | 'crash' | 'series', number];
    /** Прогоняет сценарий на одной книге в отдельном node; ответ — по шагу. */
    function scenario(cfg: object, ops: Op[]): unknown[] {
      const src = `import { createCrashBook } from ${JSON.stringify(MODULE)};
const book = createCrashBook(${JSON.stringify(cfg)});
const out = ${JSON.stringify(ops)}.map(([op, t]) =>
  op === 'launch' ? book.launchEnv(t) : op === 'crash' ? book.crash(t) : book.newSeries() ?? null);
process.stdout.write(JSON.stringify(out));`;
      const out = execFileSync(process.execPath, [
        '--input-type=module',
        '-e',
        src,
      ]);
      return JSON.parse(out.toString()) as unknown[];
    }
    const MIN = 60_000;
    const cfg = { windowMs: 15 * MIN, maxFails: 3, hourMaxFails: 6 };

    it('период 8,5 мин: в 15 мин два падения, лимит даёт час на 6-м', () => {
      const ops: Op[] = [];
      for (let i = 1; i <= 6; i++) ops.push(['crash', i * 8.5 * MIN]);
      const res = scenario(cfg, ops) as {
        fails: number;
        hourFails: number;
        limit: boolean;
        note: string;
      }[];
      expect(res.map((r) => r.fails)).toEqual([1, 2, 2, 2, 2, 2]);
      expect(res.map((r) => r.limit)).toEqual([
        false,
        false,
        false,
        false,
        false,
        true,
      ]);
      expect(res[5].note).toBe(', за час 6/6');
    });

    it('контроль: падение раз в 30 мин не паркует ни одно окно', () => {
      const ops: Op[] = [];
      for (let i = 1; i <= 8; i++) ops.push(['crash', i * 30 * MIN]);
      const res = scenario(cfg, ops) as { limit: boolean }[];
      expect(res.every((r) => !r.limit)).toBe(true);
    });

    it('новая серия обнуляет лимит, но не сутки: DM на 1, 2, 4, 8 падениях', () => {
      const ops: Op[] = [['launch', 0]];
      for (let i = 1; i <= 9; i++) {
        ops.push(['crash', i * MIN]);
        if (i % 3 === 0) ops.push(['series', i * MIN]);
        ops.push(['launch', i * MIN + 1]);
      }
      const envs = scenario(cfg, ops).filter(
        (r): r is Record<string, string> =>
          !!r && typeof r === 'object' && 'STARTUP_LAUNCH' in r,
      );
      expect(
        envs.map((e) =>
          [e.STARTUP_LAUNCH, e.STARTUP_CRASHES_DAY, e.STARTUP_NOTICE].join('/'),
        ),
      ).toEqual([
        '1/0/1',
        '2/1/1',
        '3/2/1',
        '4/3/0',
        '5/4/1',
        '6/5/0',
        '7/6/0',
        '8/7/0',
        '9/8/1',
        '10/9/0',
      ]);
    });

    it('скользящие сутки у потолка (4 → 3 → 4) не шлют DM повторно', () => {
      const day = 10 * MIN;
      const ops: Op[] = [
        ['crash', 1 * MIN],
        ['crash', 2 * MIN],
        ['crash', 3 * MIN],
        ['crash', 4 * MIN],
        ['launch', 4 * MIN + 1], // 4 за сутки → DM
        ['crash', 11.5 * MIN], // первое выпало, это пятое → 4 снова
        ['launch', 11.5 * MIN + 1],
      ];
      const envs = scenario({ ...cfg, dayMs: day }, ops).filter(
        (r): r is Record<string, string> =>
          !!r && typeof r === 'object' && 'STARTUP_LAUNCH' in r,
      );
      expect(envs.map((e) => e.STARTUP_CRASHES_DAY)).toEqual(['4', '4']);
      expect(envs.map((e) => e.STARTUP_NOTICE)).toEqual(['1', '0']);
    });
  });
});
