// @vitest-environment jsdom
// Подсветка «сегодня» в недельной полосе стрика. Регрессия
// (docs/open/frontend-ux.md): TODAY_DOW_IDX считался один раз при загрузке
// модуля — профиль, открытый через полночь, подсвечивал вчера.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { StreakCard } from './StreakCard';
import { mondayIndexOf } from './streakConst';
import { forEachTimeZone } from '../../../../shared/src/utils/timeZone.test-helpers';
import type { StreakData } from './profileMeta';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const STREAK: StreakData = {
  currentStreak: 2, longestStreak: 5, totalDays: 9, todayDone: true,
  weekDots: [true, true, false, false, false, false, false],
};

const todayName = (c: HTMLElement) => c.querySelector('.cpf-week-name.is-today')?.textContent;

describe('mondayIndexOf — день недели с понедельника', () => {
  it('пн → 0, вс → 6 в любой зоне (день — сам календарный день)', () => {
    forEachTimeZone((tz) => {
      expect(mondayIndexOf('2026-11-02'), tz).toBe(0);
      expect(mondayIndexOf('2026-11-06'), tz).toBe(4);
      expect(mondayIndexOf('2026-11-08'), tz).toBe(6);
    });
  });

  it('нечитаемая строка — подсветки нет', () => {
    expect(mondayIndexOf('')).toBe(-1);
  });
});

describe('StreakCard — подсветка «сегодня»', () => {
  it('подсвечен местный день устройства', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 6, 12, 0)); // пятница
    const { container } = render(<StreakCard streak={STREAK} />);
    expect(todayName(container)).toBe('пт');
    expect(container.querySelectorAll('.cpf-week-bar.is-today')).toHaveLength(1);
  });

  it('страница, открытая через полночь, переносит подсветку на новый день', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 2, 23, 59, 50)); // понедельник
    const { container } = render(<StreakCard streak={STREAK} />);
    expect(todayName(container)).toBe('пн');
    vi.setSystemTime(new Date(2026, 10, 3, 0, 0, 10)); // вторник
    act(() => { window.dispatchEvent(new Event('focus')); }); // возврат на вкладку
    expect(todayName(container)).toBe('вт');
  });
});
