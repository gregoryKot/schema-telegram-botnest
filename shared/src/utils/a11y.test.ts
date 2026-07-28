// @vitest-environment jsdom
// pressable() — единая точка клавиатурной активации не-кнопочных элементов
// (a11y-храповик, правило №9). Проверяем контракт props + Enter/Space/другое.
import { describe, it, expect, vi } from 'vitest';
import { pressable } from './a11y';

function keyEvent(key: string) {
  return {
    key,
    preventDefault: vi.fn(),
  } as unknown as import('react').KeyboardEvent;
}

describe('pressable', () => {
  it('возвращает role="button" и tabIndex=0', () => {
    const p = pressable(vi.fn());
    expect(p.role).toBe('button');
    expect(p.tabIndex).toBe(0);
  });

  it('onClick вызывает handler', () => {
    const handler = vi.fn();
    pressable(handler).onClick();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('Enter вызывает handler и preventDefault', () => {
    const handler = vi.fn();
    const p = pressable(handler);
    const e = keyEvent('Enter');
    p.onKeyDown(e);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(e.preventDefault).toHaveBeenCalledTimes(1);
  });

  it('Space (" ") вызывает handler и preventDefault', () => {
    const handler = vi.fn();
    const p = pressable(handler);
    const e = keyEvent(' ');
    p.onKeyDown(e);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(e.preventDefault).toHaveBeenCalledTimes(1);
  });

  it('другая клавиша не вызывает handler', () => {
    const handler = vi.fn();
    const p = pressable(handler);
    p.onKeyDown(keyEvent('Tab'));
    expect(handler).not.toHaveBeenCalled();
  });

  it('принимает и sync, и async, и short-circuit handler без падения', () => {
    const asyncHandler = vi.fn().mockResolvedValue(undefined);
    expect(() => pressable(asyncHandler).onClick()).not.toThrow();
    expect(asyncHandler).toHaveBeenCalledTimes(1);

    const shortCircuit = vi.fn(() => false as const);
    expect(() => pressable(shortCircuit).onClick()).not.toThrow();
  });
});
