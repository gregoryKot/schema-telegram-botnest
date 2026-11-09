// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { DayBars } from './DayBars';
import { barShare } from './trackerFlow';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NEED_DATA_PAPER } from '../art/paper';
import type { Need } from '../../types';

afterEach(cleanup);

const NEEDS: Need[] = [
  { id: 'attachment', emoji: '', title: 'Привязанность', chartLabel: 'Привяз.' },
  { id: 'autonomy', emoji: '', title: 'Автономия', chartLabel: 'Автон.' },
];
// Порядок на экране не совпадает с NEED_ORDER: цвет идёт за потребностью, а не за местом.
const SWAPPED: Need[] = [
  { id: 'limits', emoji: '', title: 'Границы', chartLabel: 'Гран.' },
  { id: 'attachment', emoji: '', title: 'Привязанность', chartLabel: 'Привяз.' },
];
const v = (el: HTMLElement) => Number(el.style.getPropertyValue('--v'));

describe('barShare', () => {
  it('оценка 0–10 → доля высоты, без оценки — 0, выше 10 не растёт', () => {
    expect([0, 2, 6, 10, 12].map(barShare)).toEqual([0, 0.2, 0.6, 1, 1]);
  });
});

describe('DayBars', () => {
  it('высота столбика растёт с оценкой, подпись — short потребности', () => {
    const { container } = render(<DayBars needs={NEEDS} ratings={{ attachment: 10, autonomy: 4 }} />);
    const [a, b] = Array.from(container.querySelectorAll<HTMLElement>('.tq-bar-col'));
    expect(v(a)).toBe(1);
    expect(v(b)).toBe(0.4);
    expect(screen.getByText('Привяз.')).toBeTruthy();
    expect(screen.getByLabelText('Автономия: Мало')).toBeTruthy();
  });

  it('оценённый столбик — цвет данных своей потребности (решение 7), а не порядок на экране', () => {
    const { container } = render(<DayBars needs={SWAPPED} ratings={{ limits: 6, attachment: 8 }} />);
    const [limits, attachment] = Array.from(container.querySelectorAll<HTMLElement>('.tq-bar-col'));
    expect(limits.style.getPropertyValue('--bar')).toBe(NEED_DATA_PAPER[4]);
    expect(attachment.style.getPropertyValue('--bar')).toBe(NEED_DATA_PAPER[0]);
  });

  it('без оценки — паз без цвета и доля 0, подпись «нет оценки»', () => {
    const { container } = render(<DayBars needs={NEEDS} ratings={{ attachment: 6 }} />);
    const empty = container.querySelectorAll<HTMLElement>('.tq-bar-col')[1];
    expect(v(empty)).toBe(0);
    expect(empty.classList.contains('is-rated')).toBe(false);
    expect(empty.style.getPropertyValue('--bar')).toBe('');
    expect(empty.parentElement!.classList.contains('tq-bar-slot')).toBe(true);
    expect(screen.getByLabelText('Автономия: нет оценки')).toBeTruthy();
  });

  it('CSS: оценённый красится --bar, высота — доля от --bar-max; паз — тон глубже бумаги, не серый', () => {
    const css = readFileSync(resolve(__dirname, '../../styles/tracker-done.css'), 'utf8');
    expect(css).toMatch(/\.tq-bar-col\.is-rated\s*\{[^}]*background:\s*var\(--bar\)/);
    expect(css).toMatch(/\.tq-bar-col\.is-rated\s*\{[^}]*height:\s*calc\(var\(--v\)\s*\*\s*var\(--bar-max\)\)/);
    expect(css).toMatch(/\.tq-bar-slot\s*\{[^}]*color-mix\(in srgb, var\(--text\)/);
    expect(css).not.toMatch(/\.tq-bar-col[^{]*\{[^}]*var\(--line\)/);
  });
});
