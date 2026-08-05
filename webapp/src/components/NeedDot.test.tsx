// @vitest-environment jsdom
// NeedDot — опознавательный знак потребности (волна 5, замена эмодзи).
// Цвет обязан приходить из shared/needs/needColors, а не из своей копии.
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { NeedDot } from './NeedDot';

afterEach(() => cleanup());

describe('NeedDot', () => {
  it('по известному id рисует точку цветом из needColor()', () => {
    const { container } = render(<NeedDot id="attachment" />);
    const dot = container.querySelector('span');
    expect(dot?.style.background).toBe('rgb(255, 107, 157)'); // #ff6b9d
  });

  it('неизвестный id — нейтральный фолбэк, не чужой цвет', () => {
    const { container } = render(<NeedDot id="not-a-real-need" />);
    const dot = container.querySelector('span');
    expect(dot?.style.background).toBe('var(--muted)');
  });

  it('явный color побеждает id', () => {
    const { container } = render(<NeedDot id="attachment" color="#000000" />);
    const dot = container.querySelector('span');
    expect(dot?.style.background).toBe('rgb(0, 0, 0)');
  });

  it('size по умолчанию — 10×10, кастомный size применяется', () => {
    const { container } = render(<NeedDot id="autonomy" size={16} />);
    const dot = container.querySelector('span');
    expect(dot?.style.width).toBe('16px');
    expect(dot?.style.height).toBe('16px');
  });
});
