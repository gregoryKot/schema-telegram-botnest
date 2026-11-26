// «0 = не оценено» — единая проверка и единый сеттер оценок (аудит 2026-11, E4).
import { describe, it, expect } from 'vitest';
import { isRated, withRating } from './ratingRecord';

describe('isRated', () => {
  it('значение больше 0 — оценено; 0, null и нет ключа — нет', () => {
    const r = { a: 6, b: 0, c: null };
    expect(isRated(r, 'a')).toBe(true);
    expect(isRated(r, 'b')).toBe(false);
    expect(isRated(r, 'c')).toBe(false);
    expect(isRated(r, 'd')).toBe(false);
  });
});

describe('withRating', () => {
  it('ставит значение, не трогая исходный объект', () => {
    const before = { a: 4 };
    expect(withRating(before, 'b', 8)).toEqual({ a: 4, b: 8 });
    expect(before).toEqual({ a: 4 });
  });

  it('0 убирает ключ — «не было оценки», а не оценка 0', () => {
    const next = withRating({ a: 4, b: 8 }, 'b', 0);
    expect(next).toEqual({ a: 4 });
    expect('b' in next).toBe(false);
  });

  it('0 по отсутствующему ключу — без изменений', () => {
    expect(withRating({ a: 4 }, 'z', 0)).toEqual({ a: 4 });
  });
});
