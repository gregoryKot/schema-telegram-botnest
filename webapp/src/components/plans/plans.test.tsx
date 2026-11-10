// @vitest-environment jsdom
// Части планов b20: подписи времени (planDoneModel), плитки пяти потребностей (NeedTiles — одна механика для пустых
// «Планов» и «Что питает»), оценка полоской (NeedScore).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { planWhen, reminderHour } from './planDoneModel';
import { NeedTiles } from './NeedTiles';
import { NeedScore } from './NourishParts';
import { REMINDER_OPTIONS } from '../../../../shared/src/practices/usePlanSheetState';

afterEach(cleanup);

describe('planDoneModel', () => {
  it('час — двумя цифрами', () => {
    expect(reminderHour(9)).toBe('09:00');
    expect(reminderHour(19)).toBe('19:00');
  });

  it('когда напомнить — словом и часом; без напоминания — только словом; чужой индекс — пусто', () => {
    const day = REMINDER_OPTIONS.findIndex(o => o.localHour === 13);
    const none = REMINDER_OPTIONS.findIndex(o => o.localHour === null);
    expect(planWhen(day)).toBe('Днём · 13:00');
    expect(planWhen(none)).toBe('Без напоминания');
    expect(planWhen(99)).toBe('');
  });
});

describe('NeedTiles', () => {
  it('пять потребностей плитками; переход без выбранной — без aria-pressed', () => {
    const onPick = vi.fn();
    render(<NeedTiles label="Потребность для плана" onPick={onPick} />);
    const tiles = screen.getAllByRole('button');
    expect(tiles).toHaveLength(5);
    expect(tiles.every(t => !t.hasAttribute('aria-pressed'))).toBe(true);
    fireEvent.click(screen.getByText('Автономия'));
    expect(onPick).toHaveBeenCalledWith('autonomy');
  });

  it('выбор потребности: открытая — aria-pressed и тон глубже, строка меты рисуется у каждой', () => {
    render(<NeedTiles label="Потребность" value="play" onPick={() => {}} meta={id => <i data-meta={id} />} />);
    const on = screen.getAllByRole('button').filter(t => t.getAttribute('aria-pressed') === 'true');
    expect(on).toHaveLength(1);
    expect(on[0].classList.contains('is-on')).toBe(true);
    expect(on[0].textContent).toContain('Спонтанность');
    expect(document.querySelectorAll('[data-meta]')).toHaveLength(5);
  });
});

describe('NeedScore', () => {
  it('оценка — полоской длины n/10, число — для чтения с экрана; вне шкалы — прижата', () => {
    const { container, rerender } = render(<NeedScore score={6} />);
    const bar = container.querySelector('.sk-need-score') as HTMLElement;
    expect(bar.getAttribute('aria-label')).toBe('6/10');
    expect(bar.style.getPropertyValue('--score')).toBe('60%');
    rerender(<NeedScore score={14} />);
    expect((container.querySelector('.sk-need-score') as HTMLElement).getAttribute('aria-label')).toBe('10/10');
  });
});
