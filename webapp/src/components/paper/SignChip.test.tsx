// @vitest-environment jsdom
// Чип со знаком (редизайн 2026-11): общий .ds-chip--toggle, слева знак сущности строчного размера;
// выбранный — галочка Check на месте знака и бумага сущности (--h), состояние — aria-pressed.
// Слот знака — только у чипа со знаком или у выбранного: у невыбранного без знака слота нет (пустой
// слот давал кривые поля, ревью волны 0, круг 2), при выборе такой чип растёт на ширину галочки.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SignChip } from './SignChip';

afterEach(cleanup);

const signOf = (btn: HTMLElement) => btn.querySelector('.pa-chip-sign')!;

describe('SignChip', () => {
  it('не выбран: знак сущности, aria-pressed=false; тап зовёт onToggle', () => {
    const onToggle = vi.fn();
    render(<SignChip label="Тревога" sign="pebbles" on={false} onToggle={onToggle} />);
    const btn = screen.getByRole('button', { name: 'Тревога' });
    expect(btn.className).toBe('ds-chip ds-chip--toggle pa-chip pa-chip--mark');
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    expect(signOf(btn).getAttribute('data-sign')).toBe('pebbles');
    expect(signOf(btn).getAttribute('aria-hidden')).toBe('true');
    expect(signOf(btn).querySelector('svg.pp-art--nav')).toBeTruthy();
    fireEvent.click(btn);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('выбран: is-on, галочка на месте знака, бумага из hue', () => {
    render(<SignChip label="Тревога" sign="pebbles" hue={45} on onToggle={() => {}} />);
    const btn = screen.getByRole('button', { name: 'Тревога' });
    expect(btn.className).toContain('is-on');
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    expect(signOf(btn).getAttribute('data-sign')).toBe('check');
    expect(btn.style.getPropertyValue('--h')).toBe('45');
  });

  it('без своего знака: у невыбранного слота нет (поля ровные), у выбранного — галочка; без hue — бумага родителя', () => {
    const { rerender } = render(<SignChip label="Утро" on={false} onToggle={() => {}} />);
    let btn = screen.getByRole('button', { name: 'Утро' });
    expect(btn.querySelector('.pa-chip-sign')).toBeNull();
    expect(btn.className).not.toContain('pa-chip--mark');
    expect(btn.getAttribute('style')).toBeNull();
    rerender(<SignChip label="Утро" on onToggle={() => {}} />);
    btn = screen.getByRole('button', { name: 'Утро' });
    expect(btn.className).toContain('pa-chip--mark');
    expect(signOf(btn).getAttribute('data-sign')).toBe('check');
    expect(signOf(btn).querySelector('svg.pp-art--nav')).toBeTruthy();
  });

  it('disabled — не нажимается', () => {
    const onToggle = vi.fn();
    render(<SignChip label="Вечер" on={false} onToggle={onToggle} disabled />);
    fireEvent.click(screen.getByRole('button', { name: 'Вечер' }));
    expect(onToggle).not.toHaveBeenCalled();
  });
});
