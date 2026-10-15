import { describe, it, expect } from 'vitest';
import { sessionNumbers } from './sessionNumbers';

describe('sessionNumbers', () => {
  it('нумерует по дате независимо от порядка в списке', () => {
    const m = sessionNumbers([
      { id: 3, date: '2026-10-10', createdAt: '2026-10-10T10:00:00Z' },
      { id: 1, date: '2026-09-01', createdAt: '2026-09-01T10:00:00Z' },
      { id: 2, date: '2026-09-20', createdAt: '2026-09-20T10:00:00Z' },
    ]);
    expect([m.get(1), m.get(2), m.get(3)]).toEqual([1, 2, 3]);
  });
  it('при равной дате — по времени создания', () => {
    const m = sessionNumbers([
      { id: 5, date: '2026-10-10', createdAt: '2026-10-10T12:00:00Z' },
      { id: 4, date: '2026-10-10', createdAt: '2026-10-10T09:00:00Z' },
    ]);
    expect(m.get(4)).toBe(1);
    expect(m.get(5)).toBe(2);
  });
  it('пустой список', () => {
    expect(sessionNumbers([]).size).toBe(0);
  });
});
