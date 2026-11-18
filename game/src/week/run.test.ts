import { describe, expect, it } from 'vitest';
import { PACE, runSpeed, secondsTo } from './run';

const base = { pace: 'run' as const, resting: false, named: false, hold: 0 };

describe('бег «Недели»', () => {
  it('Саша движется сам в любом кадре: шаг, трусца, бег', () => {
    expect(runSpeed({ ...base, pace: 'walk' })).toBe(PACE.walk);
    expect(runSpeed({ ...base, pace: 'jog' })).toBe(PACE.jog);
    expect(runSpeed(base)).toBe(PACE.run);
    expect(PACE.walk).toBeLessThan(PACE.jog);
    expect(PACE.jog).toBeLessThan(PACE.run);
  });
  it('без сил Саша плетётся, но не останавливается', () => {
    const v = runSpeed({ ...base, resting: true });
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThan(PACE.walk);
  });
  it('останавливает бег только удержание ПАУЗЫ', () => {
    expect(runSpeed({ ...base, hold: 0.5 })).toBe(PACE.run / 2);
    expect(runSpeed({ ...base, hold: 1 })).toBe(0);
    expect(runSpeed({ ...base, hold: 7 })).toBe(0);
  });
  it('после названия сбоя — шагом, каким бы ни был темп места', () => {
    expect(runSpeed({ ...base, named: true })).toBe(PACE.walk);
    expect(runSpeed({ ...base, named: true, resting: true, hold: 1 })).toBe(PACE.walk);
  });
  it('время хода считается по темпу каждого отрезка', () => {
    const beats = [{ x: 180, pace: 'run' as const }, { x: 410 }, { x: 640, pace: 'walk' as const }];
    expect(secondsTo(100, 'walk', beats, 180)).toBeCloseTo(1);
    expect(secondsTo(100, 'walk', beats, 640)).toBeCloseTo(3);
    expect(secondsTo(100, 'walk', beats, 720)).toBeCloseTo(4);
  });
});
