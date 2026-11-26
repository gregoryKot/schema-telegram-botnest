// @vitest-environment jsdom
// Тумблер «Меньше движения» (нейроинклюзивность, волна 1) — хук общий для
// SettingsSheet обоих фронтендов. Тестирует связку toggle → localStorage →
// повторное чтение (read-after-write), а не только факт вызова setState.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReducedMotionPref } from './useReducedMotionPref';

const matchMedia = (matches: boolean) =>
  vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useReducedMotionPref — системная настройка выключена', () => {
  beforeEach(() => {
    window.matchMedia = matchMedia(false);
  });

  it('дефолт: reduced=false, sub объясняет ручной режим', () => {
    const { result } = renderHook(() => useReducedMotionPref());
    expect(result.current.reduced).toBe(false);
    expect(result.current.systemReduced).toBe(false);
    expect(result.current.sub).toBe('Без анимаций и конфетти');
  });

  it('toggle включает reduced и сохраняет в localStorage (read-after-write)', () => {
    const { result } = renderHook(() => useReducedMotionPref());
    act(() => result.current.toggle());
    expect(result.current.reduced).toBe(true);
    expect(localStorage.getItem('reduce_motion')).toBe('1');
  });

  it('повторный toggle возвращает обратно и чистит localStorage', () => {
    const { result } = renderHook(() => useReducedMotionPref());
    act(() => result.current.toggle());
    act(() => result.current.toggle());
    expect(result.current.reduced).toBe(false);
    expect(localStorage.getItem('reduce_motion')).toBeNull();
  });

  it('вызывает onChanged после ручного toggle', () => {
    const onChanged = vi.fn();
    const { result } = renderHook(() => useReducedMotionPref(onChanged));
    act(() => result.current.toggle());
    expect(onChanged).toHaveBeenCalledTimes(1);
  });
});

describe('useReducedMotionPref — системная настройка включена', () => {
  beforeEach(() => {
    window.matchMedia = matchMedia(true);
  });

  it('reduced=true и залочен: toggle не меняет состояние и не зовёт onChanged', () => {
    const onChanged = vi.fn();
    const { result } = renderHook(() => useReducedMotionPref(onChanged));
    expect(result.current.reduced).toBe(true);
    expect(result.current.sub).toBe('Включено настройкой системы');
    act(() => result.current.toggle());
    expect(result.current.reduced).toBe(true);
    expect(onChanged).not.toHaveBeenCalled();
  });
});
