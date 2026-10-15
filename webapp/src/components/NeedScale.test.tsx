// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { NeedScale } from './NeedScale';
import { isSegmentFilled } from './needScaleModel';

afterEach(() => cleanup());

describe('isSegmentFilled', () => {
  it('заполнены сегменты до оценки включительно', () => {
    expect([1, 3, 4, 10].map(n => isSegmentFilled(n, 3))).toEqual([true, true, false, false]);
  });
  it('без оценки пусто, при 10 заполнено всё', () => {
    expect(isSegmentFilled(1, undefined)).toBe(false);
    expect(isSegmentFilled(10, 10)).toBe(true);
  });
});

describe('NeedScale', () => {
  it('рисует десять кнопок «N из 10» в группе с названием потребности', () => {
    render(<NeedScale value={4} hue={28} onChange={vi.fn()} label="Привязанность" />);
    expect(screen.getByRole('group', { name: 'Привязанность' })).toBeTruthy();
    expect(screen.getAllByRole('button')).toHaveLength(10);
    expect(screen.getByRole('button', { name: '1 из 10' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '10 из 10' })).toBeTruthy();
  });

  it('заполняет сегменты по оценке и отмечает текущую aria-pressed', () => {
    render(<NeedScale value={4} hue={28} onChange={vi.fn()} label="x" />);
    const btns = screen.getAllByRole('button');
    expect(btns.filter(b => b.classList.contains('is-on'))).toHaveLength(4);
    expect(screen.getByRole('button', { name: '4 из 10' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: '5 из 10' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('клик по сегменту отдаёт его номер', () => {
    const onChange = vi.fn();
    render(<NeedScale value={undefined} hue={28} onChange={onChange} label="x" />);
    fireEvent.click(screen.getByRole('button', { name: '8 из 10' }));
    expect(onChange).toHaveBeenCalledWith(8);
  });

  it('отмечает вчерашнюю оценку, без неё — ничего', () => {
    const { rerender } = render(<NeedScale value={7} hue={28} onChange={vi.fn()} label="x" yesterday={5} />);
    const marked = screen.getAllByRole('button').filter(b => b.classList.contains('is-yesterday'));
    expect(marked.map(b => b.getAttribute('aria-label'))).toEqual(['5 из 10']);
    rerender(<NeedScale value={7} hue={28} onChange={vi.fn()} label="x" />);
    expect(screen.getAllByRole('button').some(b => b.classList.contains('is-yesterday'))).toBe(false);
  });
});
