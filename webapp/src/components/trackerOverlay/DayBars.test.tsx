// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { DayBars } from './DayBars';
import type { Need } from '../../types';

afterEach(cleanup);

const NEEDS: Need[] = [
  { id: 'attachment', emoji: '', title: 'Привязанность', chartLabel: 'Привяз.' },
  { id: 'autonomy', emoji: '', title: 'Автономия', chartLabel: 'Автон.' },
];

describe('DayBars', () => {
  it('высота столбика растёт с оценкой, подпись — short потребности', () => {
    const { container } = render(<DayBars needs={NEEDS} ratings={{ attachment: 10, autonomy: 4 }} />);
    const [a, b] = Array.from(container.querySelectorAll<HTMLElement>('.tq-bar-col'));
    expect(parseInt(a.style.height)).toBeGreaterThan(parseInt(b.style.height));
    expect(screen.getByText('Привяз.')).toBeTruthy();
    expect(screen.getByLabelText('Автономия: Мало')).toBeTruthy();
  });

  it('без оценки — тонкая полоска без цвета потребности и подпись «нет оценки»', () => {
    const { container } = render(<DayBars needs={NEEDS} ratings={{ attachment: 6 }} />);
    const empty = container.querySelectorAll<HTMLElement>('.tq-bar-col')[1];
    expect(empty.style.height).toBe('4px');
    expect(empty.classList.contains('tone-fill')).toBe(false);
    expect(screen.getByLabelText('Автономия: нет оценки')).toBeTruthy();
  });
});
