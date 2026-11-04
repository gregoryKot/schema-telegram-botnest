// Клавиатура ползунка «Колеса детства» (QA 2026-11, З13) — одна на обе площадки.
import { describe, it, expect } from 'vitest';
import { ratingKeyValue } from './useRatingSlider';

describe('ratingKeyValue', () => {
  it('неоценённая потребность: стрелки идут от середины, Enter и пробел ставят середину', () => {
    expect(ratingKeyValue('ArrowRight', undefined)).toBe(6);
    expect(ratingKeyValue('ArrowDown', undefined)).toBe(4);
    expect(ratingKeyValue('Enter', undefined)).toBe(5);
    expect(ratingKeyValue(' ', undefined)).toBe(5);
  });

  it('оценённая: шаг 1 стрелками, 2 страницей, края — Home/End, Enter не меняет', () => {
    expect(ratingKeyValue('ArrowUp', 7)).toBe(8);
    expect(ratingKeyValue('ArrowLeft', 7)).toBe(6);
    expect(ratingKeyValue('PageUp', 7)).toBe(9);
    expect(ratingKeyValue('PageDown', 7)).toBe(5);
    expect(ratingKeyValue('Home', 7)).toBe(0);
    expect(ratingKeyValue('End', 7)).toBe(10);
    expect(ratingKeyValue('Enter', 7)).toBe(7);
  });

  it('не выходит за 0–10 и не трогает чужие клавиши', () => {
    expect(ratingKeyValue('ArrowRight', 10)).toBe(10);
    expect(ratingKeyValue('PageDown', 1)).toBe(0);
    expect(ratingKeyValue('Tab', 3)).toBeNull();
    expect(ratingKeyValue('a', undefined)).toBeNull();
  });
});
