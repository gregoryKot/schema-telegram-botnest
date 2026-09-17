// @vitest-environment jsdom
// useIsMobile — реактивный флаг узкого экрана (0% покрытия). Проверяем
// начальное значение по innerWidth и обновление по событию resize.
import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIsMobile } from './useIsMobile';

function setWidth(w: number) {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: w });
}

afterEach(() => {
  setWidth(1024);
});

describe('useIsMobile', () => {
  it('узкий экран (< breakpoint) — сразу true', () => {
    setWidth(400);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('широкий экран (>= breakpoint) — сразу false', () => {
    setWidth(1200);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it('кастомный breakpoint учитывается', () => {
    setWidth(900);
    const { result } = renderHook(() => useIsMobile(1000));
    expect(result.current).toBe(true);
  });

  it('изменение ширины окна (resize) обновляет значение', () => {
    setWidth(1200);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
    act(() => {
      setWidth(400);
      window.dispatchEvent(new Event('resize'));
    });
    expect(result.current).toBe(true);
  });
});
