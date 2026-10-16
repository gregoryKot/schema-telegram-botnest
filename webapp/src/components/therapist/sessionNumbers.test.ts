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
  it('показаны последние 100 из 105 → ранняя показанная — Сессия 6, последняя — 105', () => {
    const notes = Array.from({ length: 100 }, (_, i) => ({
      id: i + 6,
      date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`,
      createdAt: `2026-01-01T00:${String(i % 60).padStart(2, '0')}:00Z`,
    }));
    // даты возрастают с id: делаем строго по id, чтобы порядок был однозначным
    const ordered = notes.map((n, i) => ({ ...n, date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10) }));
    const m = sessionNumbers(ordered, 105);
    expect(m.get(6)).toBe(6);
    expect(m.get(105)).toBe(105);
  });
  it('total меньше длины списка не даёт отрицательного сдвига', () => {
    const m = sessionNumbers([{ id: 1, date: '2026-01-01', createdAt: '2026-01-01T00:00:00Z' }], 0);
    expect(m.get(1)).toBe(1);
  });
});
