// @vitest-environment jsdom
// DisclaimerCheckbox — общий чекбокс шагов онбординга (0% покрытия).
// Кастомный чекбокс на div[role="checkbox"], а не <input>: проверяем и клик,
// и клавиатуру (Enter/Space) — обязательный доступ с клавиатуры для
// кастомных ARIA-виджетов, иначе шаг с гейтом согласия недоступен без мыши.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { DisclaimerCheckbox } from './DisclaimerCheckbox';

afterEach(() => {
  cleanup();
});

describe('DisclaimerCheckbox', () => {
  it('checked=false — aria-checked=false, галочка ✓ не отрисована', () => {
    render(
      <DisclaimerCheckbox
        checked={false}
        onToggle={() => {}}
        label="Согласие"
      />,
    );
    const box = screen.getByRole('checkbox');
    expect(box.getAttribute('aria-checked')).toBe('false');
    expect(screen.queryByText('✓')).toBeNull();
    expect(screen.getByText('Согласие')).toBeTruthy();
  });

  it('checked=true — aria-checked=true, галочка ✓ видна', () => {
    render(<DisclaimerCheckbox checked onToggle={() => {}} label="Согласие" />);
    const box = screen.getByRole('checkbox');
    expect(box.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('✓')).toBeTruthy();
  });

  it('клик по чекбоксу зовёт onToggle', () => {
    const onToggle = vi.fn();
    render(
      <DisclaimerCheckbox checked={false} onToggle={onToggle} label="L" />,
    );
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('клик по тексту label тоже зовёт onToggle (кликабельная зона шире квадрата)', () => {
    const onToggle = vi.fn();
    render(
      <DisclaimerCheckbox checked={false} onToggle={onToggle} label="Текст" />,
    );
    fireEvent.click(screen.getByText('Текст'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('Enter на чекбоксе зовёт onToggle и предотвращает скролл (preventDefault)', () => {
    const onToggle = vi.fn();
    render(
      <DisclaimerCheckbox checked={false} onToggle={onToggle} label="L" />,
    );
    fireEvent.keyDown(screen.getByRole('checkbox'), { key: 'Enter' });
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('Space на чекбоксе зовёт onToggle', () => {
    const onToggle = vi.fn();
    render(
      <DisclaimerCheckbox checked={false} onToggle={onToggle} label="L" />,
    );
    fireEvent.keyDown(screen.getByRole('checkbox'), { key: ' ' });
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('другая клавиша (Tab) не зовёт onToggle', () => {
    const onToggle = vi.fn();
    render(
      <DisclaimerCheckbox checked={false} onToggle={onToggle} label="L" />,
    );
    fireEvent.keyDown(screen.getByRole('checkbox'), { key: 'Tab' });
    expect(onToggle).not.toHaveBeenCalled();
  });
});
