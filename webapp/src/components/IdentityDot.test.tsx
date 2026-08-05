// @vitest-environment jsdom
// IdentityDot — опознавательный знак потребности/режима (волна 5/6, замена эмодзи).
// Цвет потребности обязан приходить из shared/needs/needColors, а не из своей копии.
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { IdentityDot } from './IdentityDot';

afterEach(() => cleanup());

describe('IdentityDot', () => {
  it('по известному id рисует точку цветом из needColor()', () => {
    const { container } = render(<IdentityDot id="attachment" />);
    const dot = container.querySelector('span');
    expect(dot?.style.background).toBe('rgb(255, 107, 157)'); // #ff6b9d
  });

  it('неизвестный id — нейтральный фолбэк, не чужой цвет', () => {
    const { container } = render(<IdentityDot id="not-a-real-need" />);
    const dot = container.querySelector('span');
    expect(dot?.style.background).toBe('var(--muted)');
  });

  it('явный color побеждает id', () => {
    const { container } = render(<IdentityDot id="attachment" color="#000000" />);
    const dot = container.querySelector('span');
    expect(dot?.style.background).toBe('rgb(0, 0, 0)');
  });

  it('size по умолчанию — 10×10, кастомный size применяется', () => {
    const { container } = render(<IdentityDot id="autonomy" size={16} />);
    const dot = container.querySelector('span');
    expect(dot?.style.width).toBe('16px');
    expect(dot?.style.height).toBe('16px');
  });

  it('готовый color без id (напр. цвет группы режимов) — используется как есть', () => {
    const { container } = render(<IdentityDot color="#7c3aed" />);
    const dot = container.querySelector('span');
    expect(dot?.style.background).toBe('rgb(124, 58, 237)');
  });
});
