import { describe, it, expect } from 'vitest';
import { dayIndex } from './dayIndex';

describe('dayIndex', () => {
  it('среднее, когда оценены все потребности', () => {
    expect(dayIndex(['a', 'b'], { a: 4, b: 7 })).toBe(5.5);
  });
  it('не все оценены или потребностей нет — null', () => {
    expect(dayIndex(['a', 'b'], { a: 4 })).toBeNull();
    expect(dayIndex([], {})).toBeNull();
  });
});
