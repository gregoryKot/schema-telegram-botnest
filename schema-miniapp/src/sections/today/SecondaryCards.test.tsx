// @vitest-environment jsdom
// Экран трекера — вторичные карточки «Потребности» и «Дневник» (CLAUDE.md —
// приоритет покрытия «экраны трекера и оценки потребностей»; правило
// «скелетоны по форме контента» — во время загрузки дневника показывается
// скелетон, а не пусто/выдуманные записи).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SecondaryCards } from './SecondaryCards';
import { Need } from '../../types';

afterEach(() => {
  cleanup();
});

const NEEDS: Need[] = [
  {
    id: 'attachment',
    emoji: '🤝',
    title: 'Привязанность',
    chartLabel: 'Привязанность',
  },
  { id: 'autonomy', emoji: '🧭', title: 'Автономия', chartLabel: 'Автономия' },
];

function baseProps(
  overrides: Partial<React.ComponentProps<typeof SecondaryCards>> = {},
) {
  return {
    needs: NEEDS,
    ratings: {},
    yesterdayRatings: {},
    ratedCount: 0,
    allRated: false,
    diariesLoaded: true,
    recentDiaries: [],
    onOpenTracker: vi.fn(),
    onOpenDiaries: vi.fn(),
    onSetDiaryTask: vi.fn(),
    ...overrides,
  };
}

describe('SecondaryCards — карточка «Потребности»', () => {
  it('счётчик показывает N / всего, пока не всё оценено', () => {
    render(<SecondaryCards {...baseProps({ ratedCount: 1 })} />);
    expect(screen.getByText('1 / 2')).toBeTruthy();
  });

  it('все потребности оценены — показывает «Готово ✓»', () => {
    render(
      <SecondaryCards {...baseProps({ allRated: true, ratedCount: 2 })} />,
    );
    expect(screen.getByText('Готово ✓')).toBeTruthy();
    expect(screen.queryByText('2 / 2')).toBeNull();
  });

  it('клик по карточке потребностей открывает историю трекера, если передан onOpenTrackerHistory', () => {
    const onOpenTrackerHistory = vi.fn();
    render(<SecondaryCards {...baseProps({ onOpenTrackerHistory })} />);
    fireEvent.click(screen.getByText('Потребности'));
    expect(onOpenTrackerHistory).toHaveBeenCalledTimes(1);
  });

  it('клик по мини-карточке потребности вызывает onOpenTrackerAt с её id (не всплывает до истории)', () => {
    const onOpenTrackerHistory = vi.fn();
    const onOpenTrackerAt = vi.fn();
    render(
      <SecondaryCards
        {...baseProps({ onOpenTrackerHistory, onOpenTrackerAt })}
      />,
    );
    fireEvent.click(screen.getAllByRole('button')[1]);
    expect(onOpenTrackerAt).toHaveBeenCalledWith('attachment');
    expect(onOpenTrackerHistory).not.toHaveBeenCalled();
  });

  it('без onOpenTrackerAt клик по потребности открывает общий трекер', () => {
    const onOpenTracker = vi.fn();
    render(<SecondaryCards {...baseProps({ onOpenTracker })} />);
    fireEvent.click(screen.getAllByRole('button')[1]);
    expect(onOpenTracker).toHaveBeenCalledTimes(1);
  });
});

describe('SecondaryCards — карточка «Дневник»', () => {
  it('дневник ещё грузится — показывает скелетон (aria-hidden плейсхолдеры), не пусто и не список', () => {
    const { container } = render(
      <SecondaryCards {...baseProps({ diariesLoaded: false })} />,
    );
    expect(
      screen.queryByText(
        'Первая запись здесь — что случилось и какая схема включилась',
      ),
    ).toBeNull();
    expect(container.querySelectorAll('[aria-hidden]').length).toBeGreaterThan(
      0,
    );
  });

  it('загружено, записей нет — пустое состояние с понятной подсказкой', () => {
    render(
      <SecondaryCards
        {...baseProps({ diariesLoaded: true, recentDiaries: [] })}
      />,
    );
    expect(
      screen.getByText(
        'Первая запись здесь — что случилось и какая схема включилась',
      ),
    ).toBeTruthy();
  });

  it('есть записи — рендерит каждую с меткой и временем', () => {
    render(
      <SecondaryCards
        {...baseProps({
          recentDiaries: [
            {
              type: 'schema',
              label: 'Партнёр не ответил',
              time: '14:20',
              dateStr: 'сегодня',
            },
            {
              type: 'gratitude',
              label: 'Список благодарностей',
              time: '',
              dateStr: 'вчера',
            },
          ],
        })}
      />,
    );
    expect(screen.getByText('Партнёр не ответил')).toBeTruthy();
    expect(screen.getByText('сегодня · 14:20')).toBeTruthy();
    expect(screen.getByText('Список благодарностей')).toBeTruthy();
    // без времени — просто дата, без « · »
    expect(screen.getByText('вчера')).toBeTruthy();
  });

  it('клик по карточке дневника вызывает onOpenDiaries', () => {
    const onOpenDiaries = vi.fn();
    render(<SecondaryCards {...baseProps({ onOpenDiaries })} />);
    fireEvent.click(screen.getByText('Дневник'));
    expect(onOpenDiaries).toHaveBeenCalledTimes(1);
  });

  it('клик «+ Поставить цель на дневник» вызывает onSetDiaryTask и не триггерит onOpenDiaries', () => {
    const onOpenDiaries = vi.fn();
    const onSetDiaryTask = vi.fn();
    render(
      <SecondaryCards {...baseProps({ onOpenDiaries, onSetDiaryTask })} />,
    );
    fireEvent.click(screen.getByText('+ Поставить цель на дневник'));
    expect(onSetDiaryTask).toHaveBeenCalledTimes(1);
    expect(onOpenDiaries).not.toHaveBeenCalled();
  });
});
