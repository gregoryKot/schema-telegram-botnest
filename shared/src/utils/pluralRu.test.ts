import { describe, it, expect } from 'vitest';
import { pluralRu } from './pluralRu';

describe('pluralRu', () => {
  it('1, 21, 31 → форма one', () => {
    expect(pluralRu(1, 'схема', 'схемы', 'схем')).toBe('схема');
    expect(pluralRu(21, 'схема', 'схемы', 'схем')).toBe('схема');
    expect(pluralRu(31, 'схема', 'схемы', 'схем')).toBe('схема');
  });

  it('2-4, 22-24 → форма few', () => {
    expect(pluralRu(2, 'схема', 'схемы', 'схем')).toBe('схемы');
    expect(pluralRu(3, 'схема', 'схемы', 'схем')).toBe('схемы');
    expect(pluralRu(4, 'схема', 'схемы', 'схем')).toBe('схемы');
    expect(pluralRu(22, 'схема', 'схемы', 'схем')).toBe('схемы');
  });

  it('0, 5-20, 25 → форма many', () => {
    expect(pluralRu(0, 'схема', 'схемы', 'схем')).toBe('схем');
    expect(pluralRu(5, 'схема', 'схемы', 'схем')).toBe('схем');
    expect(pluralRu(11, 'схема', 'схемы', 'схем')).toBe('схем');
    expect(pluralRu(12, 'схема', 'схемы', 'схем')).toBe('схем');
    expect(pluralRu(14, 'схема', 'схемы', 'схем')).toBe('схем');
    expect(pluralRu(25, 'схема', 'схемы', 'схем')).toBe('схем');
  });

  it('11-14 — особый случай (не совпадает с 1/2-4 несмотря на последнюю цифру)', () => {
    expect(pluralRu(111, 'схема', 'схемы', 'схем')).toBe('схем');
    expect(pluralRu(112, 'схема', 'схемы', 'схем')).toBe('схем');
  });
});
