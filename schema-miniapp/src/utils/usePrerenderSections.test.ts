// @vitest-environment jsdom
// usePrerenderSections — третий ярус прогрева: скрытая сборка чужих вкладок
// по одной с паузой 2.5с после готовности первого экрана. Пауза вместо
// onIdle: на iOS requestIdleCallback нет, 600мс-фолбэк врезал сборки в пик
// старта (панель замеров владельца 2026-08-26 — блоки 1.7-1.9с ровно на
// метках сборка:*).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePrerenderSections } from './usePrerenderSections';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const tick = (ms: number) => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

describe('usePrerenderSections', () => {
  it('до готовности первого экрана не планирует ничего', () => {
    const { result } = renderHook(() => usePrerenderSections(false, 'today'));
    tick(10_000);
    expect(result.current.size).toBe(0);
  });

  it('после готовности собирает чужие вкладки по одной каждые 2.5с, текущую не трогает', () => {
    const { result, rerender } = renderHook(
      ({ ready }) => usePrerenderSections(ready, 'today'),
      { initialProps: { ready: false } },
    );
    rerender({ ready: true });

    tick(2_400);
    expect(result.current.size).toBe(0);
    tick(200);
    expect([...result.current]).toEqual(['schemas']);
    tick(2_500);
    expect([...result.current]).toEqual(['schemas', 'help']);
    tick(2_500);
    expect([...result.current]).toEqual(['schemas', 'help', 'profile']);
    expect(result.current.has('today')).toBe(false);
  });

  it('план строится один раз — повторная смена ready его не перезапускает', () => {
    const { result, rerender } = renderHook(
      ({ ready }) => usePrerenderSections(ready, 'today'),
      { initialProps: { ready: true } },
    );
    tick(10_000);
    expect(result.current.size).toBe(3);
    rerender({ ready: false });
    rerender({ ready: true });
    tick(10_000);
    expect(result.current.size).toBe(3);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('смена вкладки пальцем план не перестраивает и таймеры не сбрасывает', () => {
    const { result, rerender } = renderHook(
      ({ current }: { current: 'today' | 'help' }) =>
        usePrerenderSections(true, current),
      { initialProps: { current: 'today' as 'today' | 'help' } },
    );
    tick(2_500);
    expect([...result.current]).toEqual(['schemas']);
    rerender({ current: 'help' });
    tick(2_500);
    expect([...result.current]).toEqual(['schemas', 'help']);
    tick(2_500);
    expect([...result.current]).toEqual(['schemas', 'help', 'profile']);
  });
});
