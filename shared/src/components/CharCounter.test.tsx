// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { CharCounter } from './CharCounter';
import { charCounterState, COUNTER_FROM_RATIO } from '../limits/textLimits';

afterEach(() => {
  cleanup();
});

// Пробелы в toLocaleString('ru-RU') — неразрывные; сравниваем без них.
const text = (c: HTMLElement) => (c.textContent ?? '').replace(/\s/g, '');

describe('charCounterState', () => {
  it('короткий текст — счётчика нет', () => {
    expect(charCounterState(0, 10000)).toBeNull();
    expect(charCounterState(7999, 10000)).toBeNull();
  });

  it('с 80% предела — остаток', () => {
    expect(charCounterState(8000, 10000)).toEqual({
      left: 2000,
      atLimit: false,
    });
    expect(charCounterState(9999, 10000)).toEqual({ left: 1, atLimit: false });
  });

  it('на пределе — atLimit; сверх (вставка мимо maxLength) остаток не уходит в минус', () => {
    expect(charCounterState(10000, 10000)).toEqual({ left: 0, atLimit: true });
    expect(charCounterState(10050, 10000)).toEqual({ left: 0, atLimit: true });
  });

  it('граница считается от самого предела: для 200 знаков счётчик с 160', () => {
    expect(COUNTER_FROM_RATIO).toBe(0.8);
    expect(charCounterState(159, 200)).toBeNull();
    expect(charCounterState(160, 200)).toEqual({ left: 40, atLimit: false });
  });
});

describe('CharCounter', () => {
  it('короткий текст — ничего не рендерит', () => {
    const { container } = render(<CharCounter length={10} max={10000} />);
    expect(container.textContent).toBe('');
  });

  it('у границы — «Осталось знаков: N», живая область выключена', () => {
    const { container } = render(<CharCounter length={9900} max={10000} />);
    expect(text(container)).toBe('Осталосьзнаков:100');
    expect(container.firstElementChild?.getAttribute('aria-live')).toBe('off');
  });

  it('always: «N/предел» с первого знака (короткое поле), даже при пустом тексте', () => {
    const { container, rerender } = render(
      <CharCounter length={0} max={500} always />,
    );
    expect(text(container)).toBe('0/500');
    rerender(<CharCounter length={500} max={500} always />);
    expect(text(container)).toBe('500/500');
    expect(container.firstElementChild?.getAttribute('aria-live')).toBe(
      'polite',
    );
  });

  it('на пределе — «Достигнут предел», живая область объявляет его', () => {
    const { container } = render(<CharCounter length={200} max={200} />);
    expect(text(container)).toBe('Достигнутпредел:200знаков');
    expect(container.firstElementChild?.getAttribute('aria-live')).toBe(
      'polite',
    );
  });
});
