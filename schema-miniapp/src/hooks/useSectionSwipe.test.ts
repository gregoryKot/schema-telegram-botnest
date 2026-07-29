// Логика свайпа между разделами, вынесенная из App.tsx. Пороги проверяем
// напрямую: раньше они жили внутри шестисотстрочного компонента и не
// тестировались вовсе.
import { describe, it, expect } from 'vitest';
import { isHorizontalSwipe, nextSection } from './useSectionSwipe';
import type { Section } from '../components/BottomNav';

const SECTIONS: Section[] = ['today', 'help', 'schemas', 'profile'];

describe('isHorizontalSwipe', () => {
  it('короткое касание — не свайп (случайный тап по экрану)', () => {
    expect(isHorizontalSwipe(40, 0)).toBe(false);
  });

  it('ровно на пороге 72px — уже свайп', () => {
    expect(isHorizontalSwipe(72, 0)).toBe(true);
  });

  it('слишком вертикальный жест — это скролл, а не листание', () => {
    expect(isHorizontalSwipe(100, 61)).toBe(false);
    expect(isHorizontalSwipe(100, 60)).toBe(true);
  });

  it('работает в обе стороны', () => {
    expect(isHorizontalSwipe(-100, 10)).toBe(true);
  });
});

describe('nextSection', () => {
  it('влево — следующий раздел, вправо — предыдущий', () => {
    expect(nextSection(SECTIONS, 'today', -100)).toBe('help');
    expect(nextSection(SECTIONS, 'help', 100)).toBe('today');
  });

  it('на краях остаёмся на месте', () => {
    expect(nextSection(SECTIONS, 'today', 100)).toBe('today');
    expect(nextSection(SECTIONS, 'profile', -100)).toBe('profile');
  });
});
