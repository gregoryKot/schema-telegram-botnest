// @vitest-environment jsdom
// Чип со знаком (редизайн 2026-11): общий .ds-chip--toggle, слева знак сущности строчного размера;
// выбранный — галочка Check на месте знака и бумага сущности (--h), состояние — aria-pressed.
// Место знака есть всегда (у невыбранного без знака — пустой слот): ширина не прыгает при выборе.
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
    expect(btn.className).toBe('ds-chip ds-chip--toggle pa-chip');
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

  it('без своего знака: место — пустой слот без рисунка, галочка только у выбранного; без hue — бумага родителя', () => {
    const { rerender } = render(<SignChip label="Утро" on={false} onToggle={() => {}} />);
    let btn = screen.getByRole('button', { name: 'Утро' });
    expect(signOf(btn).className).toBe('pa-chip-sign');
    expect(signOf(btn).getAttribute('data-sign')).toBeNull();
    expect(signOf(btn).querySelector('svg')).toBeNull();
    expect(btn.getAttribute('style')).toBeNull();
    rerender(<SignChip label="Утро" on onToggle={() => {}} />);
    btn = screen.getByRole('button', { name: 'Утро' });
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
