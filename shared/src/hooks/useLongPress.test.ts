// @vitest-environment jsdom
// Долгое нажатие — жест без аффорданса, поэтому его поведение фиксируем
// тестом: срабатывает по удержанию, НЕ срабатывает при скролле и обычном тапе,
// и гасит клик после себя (иначе удержание карточки заодно нажмёт кнопку внутри).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useLongPress } from './useLongPress';

const down = (x = 0, y = 0) =>
  ({ button: 0, isPrimary: true, clientX: x, clientY: y }) as never;
const move = (x: number, y: number) => ({ clientX: x, clientY: y }) as never;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useLongPress', () => {
  it('срабатывает после удержания', () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useLongPress(fn));
    result.current.onPointerDown(down());
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(500);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('обычный тап не считается долгим нажатием', () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useLongPress(fn));
    result.current.onPointerDown(down());
    vi.advanceTimersByTime(150);
    result.current.onPointerUp();
    vi.advanceTimersByTime(500);
    expect(fn).not.toHaveBeenCalled();
  });

  it('скролл отменяет жест', () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useLongPress(fn));
    result.current.onPointerDown(down(0, 0));
    result.current.onPointerMove(move(0, 40)); // палец уехал вниз
    vi.advanceTimersByTime(500);
    expect(fn).not.toHaveBeenCalled();
  });

  it('микродрожание пальца жест не отменяет', () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useLongPress(fn));
    result.current.onPointerDown(down(0, 0));
    result.current.onPointerMove(move(3, 4));
    vi.advanceTimersByTime(500);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('правый клик и мультитач жестом не считаются', () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useLongPress(fn));
    result.current.onPointerDown({
      button: 2,
      isPrimary: true,
      clientX: 0,
      clientY: 0,
    } as never);
    result.current.onPointerDown({
      button: 0,
      isPrimary: false,
      clientX: 0,
      clientY: 0,
    } as never);
    vi.advanceTimersByTime(500);
    expect(fn).not.toHaveBeenCalled();
  });

  it('после срабатывания гасит клик — но только один раз', () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useLongPress(fn));
    const click = { preventDefault: vi.fn(), stopPropagation: vi.fn() };

    result.current.onPointerDown(down());
    vi.advanceTimersByTime(500);
    result.current.onClickCapture(click as never);
    expect(click.preventDefault).toHaveBeenCalledTimes(1);

    // следующий обычный тап по карточке проходит как обычно
    result.current.onClickCapture(click as never);
    expect(click.preventDefault).toHaveBeenCalledTimes(1);
  });
});
