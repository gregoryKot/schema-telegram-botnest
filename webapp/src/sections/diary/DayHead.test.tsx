// @vitest-environment jsdom
// Строка даты дня (b11): трекер дня — полоски с индексом в строке даты, а не карточка; сводка недели.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DayHead } from './DayHead';
import { WeekSummary } from './WeekSummary';
import { buildTrackerDays } from './trackerEntries';

const [day] = buildTrackerDays([{ date: '2026-10-15', ratings: { attachment: 8, autonomy: 6, expression: 7, play: 7, limits: 8 } }]);

describe('DayHead', () => {
  it('трекер дня — кнопка, видно «индекс 7,2» (полное имя — в aria-label) и полоски по оценкам', () => {
    const onOpen = vi.fn();
    const { container } = render(<DayHead dateKey="2026-10-15" tracker={day} onOpenTracker={onOpen} />);
    fireEvent.click(screen.getByRole('button', { name: 'Трекер — индекс 7,2' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(screen.getByText('индекс 7,2')).toBeTruthy();
    expect(container.querySelectorAll('[data-rated="yes"]')).toHaveLength(5);
  });

  it('без перехода (лист «Дневники» из практик) — не кнопка, но имя для чтения с экрана есть', () => {
    render(<DayHead dateKey="2026-10-15" tracker={day} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByLabelText('Трекер — индекс 7,2')).toBeTruthy();
  });

  it('день без трекера — только дата', () => {
    const { container } = render(<DayHead dateKey="2026-10-15" tracker={null} />);
    expect(container.querySelector('.cd-tracker')).toBeNull();
    expect(screen.getByText('15 октября')).toBeTruthy();
  });
});

describe('WeekSummary', () => {
  it('строки — знак, ярлык и число; пустая неделя — листа нет', () => {
    const { container, rerender } = render(<WeekSummary rows={[{ kind: 'case', count: 2 }, { kind: 'tracker', count: 5 }]} />);
    expect([...container.querySelectorAll('.cd-week-row')].map((r) => r.textContent)).toEqual(['Разбор2', 'Трекер5']);
    rerender(<WeekSummary rows={[]} />);
    expect(container.querySelector('.cd-week')).toBeNull();
  });
});
