import { describe, it, expect } from 'vitest';
import type { Need } from '../../types';
import { sidebarDayIndex } from './sidebarDayIndex';

const needs = [{ id: 'a' }, { id: 'b' }] as Need[];

describe('sidebarDayIndex — индекс дня только из реальных оценок', () => {
  it('оценены все — среднее', () => {
    expect(sidebarDayIndex(needs, { a: 8, b: 6 })).toBe(7);
  });

  it('оценены не все или потребностей нет — null, а не число', () => {
    expect(sidebarDayIndex(needs, { a: 8 })).toBeNull();
    expect(sidebarDayIndex([], {})).toBeNull();
  });
});
