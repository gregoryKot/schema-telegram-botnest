// @vitest-environment jsdom
// Части колеса детства (b19): строка шага оценки (полюс шкалы ближе к оценке — на бумаге, без красного и
// зелёного), строки результата (текст полюса по оценке, число цветом потребности) и «Связать с сегодня»
// (переход есть — кнопка со стрелкой; нет — лист без стрелки, не кнопка).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { NEED_TEXT_INK } from '../../history/needInk';
import { NEEDS } from './needs';
import { NeedRateRow } from './NeedRateRow';
import { ResultRows, NextToday } from './ResultParts';

afterEach(() => cleanup());

const attachment = NEEDS[0];

describe('NeedRateRow', () => {
  const ends = (container: HTMLElement) => [...container.querySelectorAll('.ex2-cw-end')].map((e) => e.classList.contains('is-on'));

  it('полюс ближе к оценке выделен: ≤4 — «дефицит», ≥8 — «насыщение», середина и «не оценено» — ни один', () => {
    const look = (value: number | undefined) => {
      const { container, unmount } = render(<NeedRateRow need={attachment} value={value} onChange={vi.fn()} />);
      const on = ends(container);
      unmount();
      return on;
    };
    expect(look(2)).toEqual([true, false]);
    expect(look(4)).toEqual([true, false]);
    expect(look(5)).toEqual([false, false]);
    expect(look(8)).toEqual([false, true]);
    expect(look(undefined)).toEqual([false, false]);
  });

  it('без оценки — «—» и «не оценено»; с оценкой — число и «/10»; строка несёт оттенок и цвет потребности', () => {
    const { container, rerender } = render(<NeedRateRow need={attachment} value={undefined} onChange={vi.fn()} />);
    const value = () => container.querySelector('.ex2-cw-value')!;
    expect(value().textContent).toBe('— не оценено');
    expect(value().classList.contains('is-unset')).toBe(true);
    rerender(<NeedRateRow need={attachment} value={6} onChange={vi.fn()} />);
    expect(value().textContent).toBe('6/10');
    const row = container.querySelector('.ex2-cw-row') as HTMLElement;
    expect(row.style.getPropertyValue('--need-text')).toBe(NEED_TEXT_INK.attachment);
    expect(row.style.getPropertyValue('--h')).not.toBe('');
  });
});

describe('ResultRows', () => {
  it('текст полюса по оценке: ≤4 — низкий, ≥8 — высокий, между — «Где-то между»', () => {
    render(<ResultRows ratings={{ attachment: 4, autonomy: 8, expression: 5, play: 6, limits: 7 }} />);
    expect(screen.getByText(NEEDS[0].low)).toBeTruthy();
    expect(screen.getByText(NEEDS[1].high)).toBeTruthy();
    expect(screen.getAllByText('Где-то между. Бывало по-разному.')).toHaveLength(3);
  });
});

describe('NextToday', () => {
  it('с переходом — кнопка со стрелкой, тап зовёт переход', () => {
    const onOpen = vi.fn();
    const { container } = render(<NextToday onOpen={onOpen} />);
    fireEvent.click(screen.getByRole('button', { name: /Связать с\sсегодня/ }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.pp-arrow')).not.toBeNull();
  });

  it('без перехода — тот же лист, но не кнопка и без стрелки', () => {
    const { container } = render(<NextToday />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText(/Связать с\sсегодня/)).toBeTruthy();
    expect(container.querySelector('.pp-arrow')).toBeNull();
  });
});
