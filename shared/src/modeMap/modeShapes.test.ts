import { describe, it, expect } from 'vitest';
import {
  BEHAVIOR_PATH,
  CRITIC_PATH,
  PENTA_PATH,
  SHIELD_PATH,
  TRIGGER_PATH,
  scalePath,
} from './modeShapes';

/** Все числа пути парами (x, y) — для проверки масштабирования. */
const pairs = (d: string): [number, number][] => {
  const nums = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
  const out: [number, number][] = [];
  for (let i = 0; i < nums.length; i += 2) out.push([nums[i], nums[i + 1]]);
  return out;
};

describe('scalePath', () => {
  it('x умножается на sx, y на sy — чередованием по порядку чисел', () => {
    expect(scalePath('M10,20 L30,40 Z', 2, 3)).toBe(
      'M20.00,60.00 L60.00,120.00 Z',
    );
  });

  it('единичный масштаб оставляет геометрию той же', () => {
    expect(pairs(scalePath(CRITIC_PATH, 1, 1))).toEqual(pairs(CRITIC_PATH));
  });

  it('дробные и отрицательные координаты масштабируются без потери знака', () => {
    expect(scalePath('M-1.5,2.5 L4,-8', 2, 2)).toBe('M-3.00,5.00 L8.00,-16.00');
  });

  it('буквы команд не трогает', () => {
    expect(scalePath(SHIELD_PATH, 1.68, 0.8).replace(/[-\d.,\s]/g, '')).toBe(
      SHIELD_PATH.replace(/[-\d.,\s]/g, ''),
    );
  });

  it('контуры помещаются в базовое пространство, поэтому масштаб не вылезает за бокс', () => {
    const inside = (d: string, w: number, h: number) =>
      pairs(scalePath(d, w / 100, h / 100)).every(
        ([x, y]) => x >= 0 && x <= w && y >= 0 && y <= h,
      );
    for (const d of [CRITIC_PATH, PENTA_PATH, SHIELD_PATH, BEHAVIOR_PATH]) {
      expect(inside(d, 168, 80)).toBe(true);
    }
    // облако живёт в пространстве 100×60
    expect(
      pairs(scalePath(TRIGGER_PATH, 196 / 100, 80 / 60)).every(
        ([x, y]) => x >= 0 && x <= 196 && y >= 0 && y <= 80,
      ),
    ).toBe(true);
  });
});
