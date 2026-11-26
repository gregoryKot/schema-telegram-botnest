// @vitest-environment jsdom
// useAuthRetryOnFocus — регресс «постоянно нужно логиниться заново»
// (2026-08-21, пункт 3): после сна устройства ничто не пыталось перевыпустить
// сессию само.
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAuthRetryOnFocus } from './useAuthRetryOnFocus';

describe('useAuthRetryOnFocus', () => {
  it('online при isStale()===true вызывает refresh', () => {
    const refresh = vi.fn();
    renderHook(() => useAuthRetryOnFocus(() => true, refresh));
    window.dispatchEvent(new Event('online'));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('online при isStale()===false НЕ вызывает refresh', () => {
    const refresh = vi.fn();
    renderHook(() => useAuthRetryOnFocus(() => false, refresh));
    window.dispatchEvent(new Event('online'));
    expect(refresh).not.toHaveBeenCalled();
  });

  it('visibilitychange в "visible" при isStale()===true вызывает refresh', () => {
    const refresh = vi.fn();
    renderHook(() => useAuthRetryOnFocus(() => true, refresh));
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('visibilitychange в "hidden" НЕ вызывает refresh (уходим из вкладки, а не возвращаемся)', () => {
    const refresh = vi.fn();
    renderHook(() => useAuthRetryOnFocus(() => true, refresh));
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(refresh).not.toHaveBeenCalled();
  });

  it('размонтирование снимает оба слушателя', () => {
    const refresh = vi.fn();
    const { unmount } = renderHook(() => useAuthRetryOnFocus(() => true, refresh));
    unmount();
    window.dispatchEvent(new Event('online'));
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(refresh).not.toHaveBeenCalled();
  });
});
