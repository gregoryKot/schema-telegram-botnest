import { describe, it, expect } from 'vitest';
import { asArray } from './safeData';

describe('asArray', () => {
  it('массив возвращается как есть, не-массив (`{}` при сбое, null) — пусто', () => {
    expect(asArray([1, 2])).toEqual([1, 2]);
    expect(asArray({} as never)).toEqual([]);
    expect(asArray(null)).toEqual([]);
    expect(asArray(undefined)).toEqual([]);
  });
});
