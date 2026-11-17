import { describe, expect, it } from 'vitest';
import { chapterWarmth, moodLook, pressureTarget, reliefAt, stepPressure, type PressureInput } from './pressure';

const quiet: PressureInput = { dists: [], hurtMs: Infinity, stuckMs: 0, exhaustion: 0 };
const p = (over: Partial<PressureInput>) => pressureTarget({ ...quiet, ...over });

describe('pressureTarget', () => {
  it('в тихой сцене давления нет', () => {
    expect(p({})).toBe(0);
    expect(p({ dists: [900] })).toBe(0);
  });

  it('враг ближе — давит сильнее, вплотную не сильнее предела', () => {
    expect(p({ dists: [300] })).toBeLessThan(p({ dists: [150] }));
    expect(p({ dists: [150] })).toBeLessThan(p({ dists: [60] }));
    expect(p({ dists: [10] })).toBe(p({ dists: [60] }));
  });

  it('врагов больше — давление растёт, но не выходит за 1', () => {
    const one = p({ dists: [80] }), three = p({ dists: [80, 80, 80] });
    expect(three).toBeGreaterThan(one);
    expect(p({ dists: Array(12).fill(0), hurtMs: 0, stuckMs: 9000, exhaustion: 1 })).toBeLessThanOrEqual(1);
  });

  it('урон звенит и затихает', () => {
    expect(p({ hurtMs: 0 })).toBeGreaterThan(p({ hurtMs: 1500 }));
    expect(p({ hurtMs: 1500 })).toBeGreaterThan(0);
    expect(p({ hurtMs: 5000 })).toBe(0);
  });

  it('короткое залипание не давит, долгое — тянет вниз', () => {
    expect(p({ stuckMs: 800 })).toBe(0);
    expect(p({ stuckMs: 3000 })).toBeGreaterThan(0);
    expect(p({ stuckMs: 6000 })).toBeGreaterThan(p({ stuckMs: 3000 }));
  });

  it('истощение держит фон холоднее и без врагов', () => {
    expect(p({ exhaustion: 0.5 })).toBeGreaterThan(0);
    expect(p({ exhaustion: 1 })).toBeGreaterThan(p({ exhaustion: 0.5 }));
  });
});

describe('stepPressure', () => {
  it('идёт к цели без перелёта, накрывает быстрее, чем отпускает', () => {
    expect(stepPressure(0, 0.4, 10000)).toBe(0.4);
    expect(stepPressure(1, 0.2, 100000)).toBe(0.2);
    const up = stepPressure(0, 1, 100), down = 1 - stepPressure(1, 0, 100);
    expect(up).toBeGreaterThan(down);
    expect(down).toBeGreaterThan(0);
  });
});

describe('reliefAt', () => {
  it('копинг греет на миг и откатывается к нулю', () => {
    expect(reliefAt(0, 0)).toBe(0);
    expect(reliefAt(300, 0)).toBe(1);
    expect(reliefAt(1000, 0)).toBeGreaterThan(0);
    expect(reliefAt(1000, 0)).toBeLessThan(1);
    expect(reliefAt(1500, 0)).toBe(0);
    expect(reliefAt(Infinity, 0)).toBe(0);
  });

  it('выжатому коту тот же копинг помогает слабее', () => {
    expect(reliefAt(300, 1)).toBeLessThan(reliefAt(300, 0));
    expect(reliefAt(300, 1)).toBeGreaterThan(0);
  });
});

describe('moodLook', () => {
  it('без давления мир не тронут, кот светится слабо', () => {
    const l = moodLook(0, 0, 0);
    expect(l.wash).toBe(0);
    expect(l.dawn).toBe(0);
    expect(l.glow).toBeGreaterThan(0);
  });

  it('давление холодит мир, а свет кота только ярче', () => {
    const calm = moodLook(0, 0, 0), tight = moodLook(1, 0, 0);
    expect(tight.wash).toBeGreaterThan(0.4);
    expect(tight.wash).toBeLessThan(0.7); // мир бледнеет, но читается
    expect(tight.glow).toBeGreaterThan(calm.glow);
  });

  it('облегчение возвращает тепло при том же давлении', () => {
    expect(moodLook(1, 1, 0).wash).toBeLessThan(moodLook(1, 0, 0).wash * 0.3);
    expect(moodLook(1, 1, 0).glow).toBeGreaterThan(moodLook(1, 0, 0).glow);
  });

  it('в главах терапии то же давление холодит слабее, а база теплее', () => {
    expect(moodLook(1, 0, 1).wash).toBeLessThan(moodLook(1, 0, 0).wash);
    expect(moodLook(0, 0, 1).dawn).toBeGreaterThan(moodLook(0, 0, 0.3).dawn);
  });
});

describe('chapterWarmth', () => {
  it('гл.1–2 без базового тепла, в терапии оно выше и растёт к финалу', () => {
    expect(chapterWarmth('chapter1', 0.9)).toBe(0);
    expect(chapterWarmth('chapter2', 0.9)).toBe(0);
    expect(chapterWarmth('chapter3', 1)).toBeGreaterThan(chapterWarmth('chapter3', 0));
    expect(chapterWarmth('chapter4', 0)).toBeGreaterThan(chapterWarmth('chapter3', 1));
    expect(chapterWarmth('chapter4', 5)).toBe(1);
  });
});
