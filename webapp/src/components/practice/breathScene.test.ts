// @vitest-environment node
// Сцена дыхания и счёт шагов: фаза SceneBreath по этапу (покой — ровно, дыхание — за фазой и за
// её длину, итог — легли; сниженная анимация — дуги стоят), состояние отрезков полосы фаз и
// счётчиков, раскладка камешков 5-4-3-2-1.
import { describe, it, expect } from 'vitest';
import { BREATH_HOLD_S, BREATH_IN_S, BREATH_OUT_S } from '../../../../shared/src/practices/breathing';
import { breathScenePhase, phaseMarks } from './breathScene';
import { PEBBLE_GROUND, pebbleRow, stepMarks } from './stepCounterModel';

describe('breathScenePhase', () => {
  it('во время дыхания дуги идут за фазой ровно за её длину', () => {
    expect(breathScenePhase('active', 'in', false)).toEqual({ phase: 'in', seconds: BREATH_IN_S });
    expect(breathScenePhase('active', 'hold', false)).toEqual({ phase: 'hold', seconds: BREATH_HOLD_S });
    expect(breathScenePhase('active', 'out', false)).toEqual({ phase: 'out', seconds: BREATH_OUT_S });
  });

  it('сниженная анимация: дуги стоят, как в покое, — фазу несут подпись и полоса', () => {
    for (const ph of ['in', 'hold', 'out'] as const) {
      expect(breathScenePhase('active', ph, true)).toEqual(breathScenePhase('idle', 'in', false));
    }
    expect(breathScenePhase('idle', 'in', false)).toEqual({ phase: 'out' });
  });

  it('итог — дуги легли, у полоски лист; без анимации — сразу, без перехода', () => {
    expect(breathScenePhase('finished', 'out', false).phase).toBe('rest');
    expect(breathScenePhase('finished', 'out', false).seconds).toBeGreaterThan(0);
    expect(breathScenePhase('finished', 'out', true)).toEqual({ phase: 'rest', seconds: undefined });
  });
});

describe('счёт шагов', () => {
  it('stepMarks: до шага — пройдены, шаг — сейчас, после — впереди; за концом — все пройдены', () => {
    expect(stepMarks(5, 0)).toEqual(['now', 'next', 'next', 'next', 'next']);
    expect(stepMarks(4, 2)).toEqual(['done', 'done', 'now', 'next']);
    expect(stepMarks(3, 3)).toEqual(['done', 'done', 'done']);
  });

  it('phaseMarks: отрезки полосы фаз в порядке круга', () => {
    expect(phaseMarks('in')).toEqual(['now', 'next', 'next']);
    expect(phaseMarks('hold')).toEqual(['done', 'now', 'next']);
    expect(phaseMarks('out')).toEqual(['done', 'done', 'now']);
  });

  it('pebbleRow: пять камешков от большого к малому, все на земле, без наложения', () => {
    const { spots, width } = pebbleRow(5);
    expect(spots).toHaveLength(5);
    for (let i = 1; i < spots.length; i++) {
      expect(spots[i].rx).toBeLessThan(spots[i - 1].rx);
      expect(spots[i].cx - spots[i].rx).toBeGreaterThan(spots[i - 1].cx + spots[i - 1].rx);
    }
    for (const s of spots) expect(s.cy + s.ry).toBeCloseTo(PEBBLE_GROUND);
    const last = spots[spots.length - 1];
    expect(width).toBeGreaterThan(last.cx + last.rx);
    expect(pebbleRow(1).spots[0].rx).toBe(24);
  });
});
