import { describe, it, expect } from 'vitest';
import { buildYsqRows, fmtDelta, deltaClass } from './ysqRows';
import { ALL_SCHEMAS } from '../../../../shared/src/schemaTherapy/schemaTherapyData';

const ids = ALL_SCHEMAS.slice(0, 7).map(s => s.id);
const run = (vals: number[]) => ({
  id: 1, completedAt: '2026-10-01T10:00:00Z',
  scores: vals.map((pct5plus, i) => ({ id: ids[i], pct5plus })),
});

describe('buildYsqRows', () => {
  it('сортирует по убыванию, помечает топ-5, считает Δ', () => {
    const rows = buildYsqRows(run([10, 70, 50, 30, 90, 20, 60]), run([10, 60, 55, 30, 80, 20]));
    expect(rows.map(r => r.pct)).toEqual([90, 70, 60, 50, 30, 20, 10]);
    expect(rows.filter(r => r.top)).toHaveLength(5);
    expect(rows[0].delta).toBe(10);
    expect(rows[3].delta).toBe(-5);
    expect(rows[2].prevPct).toBeNull();
    expect(rows[2].delta).toBeNull();
    expect(rows[0].domainId).toBeTruthy();
  });
  it('без прошлого прохождения Δ нет', () => {
    const rows = buildYsqRows(run([40, 20]), null);
    expect(rows.every(r => r.delta === null && r.prevPct === null)).toBe(true);
  });
});

describe('fmtDelta / deltaClass', () => {
  it('формат и класс', () => {
    expect(fmtDelta(5)).toBe('+5');
    expect(fmtDelta(-3)).toBe('-3');
    expect(fmtDelta(0)).toBe('0');
    expect(fmtDelta(null)).toBe('–');
    expect(deltaClass(-1)).toBe('is-down');
    expect(deltaClass(1)).toBe('is-up');
    expect(deltaClass(0)).toBe('is-zero');
    expect(deltaClass(null)).toBe('is-zero');
  });
});
