// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { DayBars } from './DayBars';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BAR_PAPER } from '../art/paper';
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

  it('оценённый столбик — бумага BAR_PAPER по порядку (--bar), неоценённый — без неё', () => {
    const { container } = render(<DayBars needs={NEEDS} ratings={{ autonomy: 6 }} />);
    const [a, b] = Array.from(container.querySelectorAll<HTMLElement>('.tq-bar-col'));
    expect(b.classList.contains('is-rated')).toBe(true);
    expect(b.style.getPropertyValue('--bar')).toBe(BAR_PAPER[1]);
    expect(a.classList.contains('is-rated')).toBe(false);
    expect(a.style.getPropertyValue('--bar')).toBe('');
    expect(container.querySelector('.tone-fill')).toBeNull(); // цвета потребностей здесь больше нет
  });

  it('CSS: оценённый красится --bar, серый — только у неоценённого (:not), иначе перебил бы бумагу', () => {
    const css = readFileSync(resolve(__dirname, '../../styles/tracker-question.css'), 'utf8');
    expect(css).toMatch(/\.tq-bar-col\.is-rated\s*\{[^}]*background:\s*var\(--bar\)/);
    expect(css).toMatch(/\.tq-bar-col:not\(\.is-rated\)\s*\{[^}]*background:\s*var\(--line\)/);
    expect(css).not.toMatch(/\.tq-bar-col\s*\{[^}]*background/);
  });

  it('без оценки — тонкая полоска без цвета потребности и подпись «нет оценки»', () => {
    const { container } = render(<DayBars needs={NEEDS} ratings={{ attachment: 6 }} />);
    const empty = container.querySelectorAll<HTMLElement>('.tq-bar-col')[1];
    expect(empty.style.height).toBe('4px');
    expect(empty.classList.contains('is-rated')).toBe(false);
    expect(screen.getByLabelText('Автономия: нет оценки')).toBeTruthy();
  });
});
