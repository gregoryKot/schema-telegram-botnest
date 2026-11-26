// Геометрия колеса: одна на колесо и его силуэт загрузки (needsWheelGeometry.ts).
import { describe, it, expect } from 'vitest';
import {
  CX,
  CY,
  R,
  petalPath,
  wheelAngle,
  wheelSectors,
} from './needsWheelGeometry';

describe('needsWheelGeometry', () => {
  it('пять полных секторов от центра на радиусе R, первый — сверху', () => {
    const s = wheelSectors(5);
    expect(s).toHaveLength(5);
    for (const d of s) expect(d.startsWith(`M ${CX} ${CY} L `)).toBe(true);
    expect(s[0]).toBe(petalPath(R, -Math.PI / 2));
    expect(new Set(s).size).toBe(5);
  });
  it('сектор меньше пикселя — пусто (нет оценки — нет лепестка)', () => {
    expect(petalPath(0.5, 0)).toBe('');
    expect(petalPath(1, 0)).not.toBe('');
  });
  it('углы идут по часовой равными шагами', () => {
    expect(wheelAngle(0, 5)).toBeCloseTo(-Math.PI / 2);
    expect(wheelAngle(1, 5) - wheelAngle(0, 5)).toBeCloseTo((2 * Math.PI) / 5);
  });
});
