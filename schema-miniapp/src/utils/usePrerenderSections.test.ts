// @vitest-environment jsdom
// usePrerenderSections — третий ярус прогрева: скрытая сборка чужих вкладок
// по одной за виток простоя, только после готовности первого экрана
// (см. комментарий в usePrerenderSections.ts, разбор 2026-08-24).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePrerenderSections } from './usePrerenderSections';

let idleQueue: (() => void)[] = [];

beforeEach(() => {
  idleQueue = [];
  Object.defineProperty(window, 'requestIdleCallback', {
    value: (cb: () => void) => {
      idleQueue.push(cb);
      return idleQueue.length;
    },
    configurable: true,
  });
});
afterEach(() => {
  Reflect.deleteProperty(window, 'requestIdleCallback');
});

const runIdleTick = () => {
  const cbs = idleQueue;
  idleQueue = [];
  act(() => cbs.forEach((cb) => cb()));
};

describe('usePrerenderSections', () => {
  it('до готовности первого экрана не планирует ничего', () => {
    const { result } = renderHook(() => usePrerenderSections(false, 'today'));
    expect(result.current.size).toBe(0);
    expect(idleQueue.length).toBe(0);
  });

  it('после готовности собирает чужие вкладки по одной за виток, текущую не трогает', () => {
    const { result, rerender } = renderHook(
      ({ ready }) => usePrerenderSections(ready, 'today'),
      { initialProps: { ready: false } },
    );
    rerender({ ready: true });

    expect(result.current.size).toBe(0);
    runIdleTick();
    expect([...result.current]).toEqual(['schemas']);
    runIdleTick();
    expect([...result.current]).toEqual(['schemas', 'help']);
    runIdleTick();
    expect([...result.current]).toEqual(['schemas', 'help', 'profile']);
    expect(result.current.has('today')).toBe(false);
    expect(idleQueue.length).toBe(0);
  });

  it('план строится один раз — повторная смена ready его не перезапускает', () => {
    const { result, rerender } = renderHook(
      ({ ready }) => usePrerenderSections(ready, 'today'),
      { initialProps: { ready: true } },
    );
    runIdleTick();
    runIdleTick();
    runIdleTick();
    rerender({ ready: false });
    rerender({ ready: true });
    expect(idleQueue.length).toBe(0);
    expect(result.current.size).toBe(3);
  });
});
