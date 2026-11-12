// @vitest-environment jsdom
// Лист трекера «Обзора» (b30): потребность — свой знак и цвет данных (inkVars, решение 7), без красного «≤4»;
// нет ни индекса, ни оценок — листа нет (данные только реальные).
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ClientTrackerSheet } from './ClientTrackerSheet';
import { needBars } from './clientOverviewModel';
import { inkVars } from '../history/needInk';

afterEach(cleanup);

describe('ClientTrackerSheet', () => {
  it('нет индекса и оценок — ничего', () => {
    const { container } = render(<ClientTrackerSheet todayIndex={null} history={[]} needs={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('потребность — знак, цвет данных своей потребности; низкая оценка не красится в красный', () => {
    const { container } = render(<ClientTrackerSheet todayIndex={null} history={[]} needs={needBars({ attachment: 3, limits: 8 })} />);
    expect(screen.getByText('Потребности сегодня')).toBeTruthy();
    const rows = Array.from(container.querySelectorAll<HTMLElement>('.tk-need'));
    expect(rows).toHaveLength(2);
    expect(rows[0].style.getPropertyValue('--need-ink')).toBe(inkVars('attachment')['--need-ink']);
    expect(rows[1].style.getPropertyValue('--need-text')).toBe(inkVars('limits')['--need-text']);
    expect(rows[0].querySelector('.tk-need-sign svg')).toBeTruthy();
    expect(container.querySelector('.is-low')).toBeNull();
    expect((rows[0].querySelector('.tk-need-bar > span') as HTMLElement).style.width).toBe('30%');
  });

  it('индекс без оценок — лист с одним «Индексом сегодня»', () => {
    render(<ClientTrackerSheet todayIndex={6} history={[{ index: 6 }]} needs={[]} />);
    expect(screen.getByText('Индекс сегодня')).toBeTruthy();
    expect(screen.queryByText('Потребности сегодня')).toBeNull();
  });
});
