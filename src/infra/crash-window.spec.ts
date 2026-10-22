// deploy/crash-window.mjs — счётчик падений в скользящем окне (аудит 2026-10,
// «Супервизор контейнера»: прогон дольше минуты обнулял счётчик, и крашлуп с
// периодом 61 с не доходил до лимита никогда). Шов — настоящий entrypoint с
// настоящими процессами — держит maintenance-startup.spec.ts; здесь границы.
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

  describe('validWindowMs', () => {
    it.each([[undefined], [''], ['abc'], ['0'], ['-5'], ['Infinity']])(
      '%p → значение по умолчанию',
      (raw) => {
        expect(call('validWindowMs', [raw, 900000])).toBe(900000);
      },
    );

    it.each([
      ['60000', 60000],
      ['100', 100],
    ])('%p → %d', (raw, want) => {
      expect(call('validWindowMs', [raw, 900000])).toBe(want);
    });
  });
});
