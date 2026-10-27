// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { DayBars } from './DayBars';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NEED_HUE } from '../../lib/tone';
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

  it('оценённый столбик — цвет потребности (tone-fill + --h из NEED_HUE), неоценённый — без них', () => {
    const { container } = render(<DayBars needs={NEEDS} ratings={{ attachment: 6 }} />);
    const [a, b] = Array.from(container.querySelectorAll<HTMLElement>('.tq-bar-col'));
    expect(a.classList.contains('tone-fill')).toBe(true);
    expect(a.style.getPropertyValue('--h')).toBe(String(NEED_HUE.attachment));
    expect(b.classList.contains('tone-fill')).toBe(false);
  });

  it('CSS: серый фон у столбика только через :not(.tone-fill), иначе он перебивает цвет потребности', () => {
    const css = readFileSync(resolve(__dirname, '../../styles/tracker-question.css'), 'utf8');
    expect(css).toMatch(/\.tq-bar-col:not\(\.tone-fill\)\s*\{[^}]*background:\s*var\(--line\)/);
    expect(css).not.toMatch(/\.tq-bar-col\s*\{[^}]*background/);
  });

  it('без оценки — тонкая полоска без цвета потребности и подпись «нет оценки»', () => {
    const { container } = render(<DayBars needs={NEEDS} ratings={{ attachment: 6 }} />);
    const empty = container.querySelectorAll<HTMLElement>('.tq-bar-col')[1];
    expect(empty.style.height).toBe('4px');
    expect(empty.classList.contains('tone-fill')).toBe(false);
    expect(screen.getByLabelText('Автономия: нет оценки')).toBeTruthy();
  });
});
