// @vitest-environment jsdom
// TodayCustomizeSheet — новая механика листа: строки блоков band идут в
// порядке orderedIds, драг — по видимому подмножеству (у не-терапевта нет
// строки баннера), «Фокус дня» без свитча (только переставляется), клавиатура
// на ручке зовёт reorder с видимым подмножеством.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { TodayCustomizeSheet } from './TodayCustomizeSheet';
import { SCREEN_BLOCK_ORDER } from '../utils/screenBlocks';

afterEach(cleanup);

type Props = Parameters<typeof TodayCustomizeSheet>[0];

function baseProps(overrides: Partial<Props> = {}): Props {
  return {
    practice: 'tracker',
    streakHidden: false,
    phraseHidden: false,
    secondaryHidden: true,
    therapistBannerHidden: false,
    showTherapistToggle: false,
    orderedIds: SCREEN_BLOCK_ORDER.today,
    reorder: vi.fn().mockReturnValue(true),
    onPractice: vi.fn(),
    onToggleStreak: vi.fn(),
    onTogglePhrase: vi.fn(),
    onToggleSecondary: vi.fn(),
    onToggleTherapistBanner: vi.fn(),
    onOpenSettings: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

describe('TodayCustomizeSheet — строки band', () => {
  it('строки идут в порядке orderedIds, у каждой есть ручка перестановки', () => {
    render(
      <TodayCustomizeSheet
        {...baseProps({
          orderedIds: [
            'phrase',
            'focus',
            'therapist_banner',
            'streak',
            'secondary',
          ],
        })}
      />,
    );
    const handles = screen.getAllByLabelText(/^Переставить:/);
    // Не-терапевт: строки баннера нет — 4 видимых строки.
    expect(handles.map((h) => h.getAttribute('aria-label'))).toEqual([
      'Переставить: Фраза для себя',
      'Переставить: Фокус дня',
      'Переставить: Карточка серии',
      'Переставить: «Что ещё можно сегодня»',
    ]);
  });

  it('терапевту видна и строка баннера кабинета', () => {
    render(
      <TodayCustomizeSheet {...baseProps({ showTherapistToggle: true })} />,
    );
    expect(screen.getByText('Кабинет терапевта')).toBeTruthy();
    expect(screen.getAllByLabelText(/^Переставить:/)).toHaveLength(5);
  });

  it('«Фокус дня» — без свитча: блок не скрывается, только переставляется', () => {
    render(<TodayCustomizeSheet {...baseProps()} />);
    // Строка фокуса не лежит внутри переключателя.
    expect(screen.getByText('Фокус дня').closest('[role="switch"]')).toBeNull();
    // Свитчи: три строки блоков (серия/фраза/«что ещё») + тумблер темы.
    expect(screen.getAllByRole('switch').length).toBe(4);
  });

  it('ArrowDown на ручке зовёт reorder с видимым подмножеством (без баннера)', () => {
    const reorder = vi.fn().mockReturnValue(true);
    render(<TodayCustomizeSheet {...baseProps({ reorder })} />);
    fireEvent.keyDown(screen.getByLabelText('Переставить: Карточка серии'), {
      key: 'ArrowDown',
    });
    expect(reorder).toHaveBeenCalledWith('streak', 1, [
      'streak',
      'focus',
      'phrase',
      'secondary',
    ]);
  });

  it('долгое нажатие на фокус подсвечивает строку «Фокус дня»', () => {
    render(<TodayCustomizeSheet {...baseProps({ highlight: 'practice' })} />);
    // Корень строки: title → обёртка текста → сам ряд (как в ToggleRow).
    const row = screen.getByText('Фокус дня').parentElement
      ?.parentElement as HTMLElement;
    const other = screen
      .getByText('Карточка серии')
      .closest('[role="switch"]') as HTMLElement;
    expect(row.style.background).not.toBe('');
    expect(other.style.background).toBe('');
  });
});
