// @vitest-environment jsdom
// Телефонная раскладка кабинета: хук следит за медиазапросом ≤767px и на
// смену ширины (поворот телефона) перерисовывает компонент.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIsPhone, PHONE_QUERY } from './useIsPhone';

type Listener = () => void;

function mockMatchMedia(initial: boolean) {
  let matches = initial;
  const listeners = new Set<Listener>();
  const queries: string[] = [];
  window.matchMedia = vi.fn().mockImplementation((query: string) => {
    queries.push(query);
    return {
      get matches() { return matches; },
      media: query,
      addEventListener: (_: string, l: Listener) => listeners.add(l),
      removeEventListener: (_: string, l: Listener) => listeners.delete(l),
    };
  }) as unknown as typeof window.matchMedia;
  return {
    queries,
    listenerCount: () => listeners.size,
    set(next: boolean) { matches = next; listeners.forEach(l => l()); },
  };
}

const original = window.matchMedia;
afterEach(() => { window.matchMedia = original; });

describe('useIsPhone', () => {
  it('без matchMedia — десктопная раскладка', () => {
    (window as unknown as { matchMedia: unknown }).matchMedia = undefined;
    const { result } = renderHook(() => useIsPhone());
    expect(result.current).toBe(false);
  });

  it('узкий экран — true, спрашивает именно ≤767px', () => {
    const mm = mockMatchMedia(true);
    const { result } = renderHook(() => useIsPhone());
    expect(result.current).toBe(true);
    expect(mm.queries).toContain(PHONE_QUERY);
    expect(PHONE_QUERY).toBe('(max-width: 767px)');
  });

  it('широкий экран — false', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useIsPhone());
    expect(result.current).toBe(false);
  });

  it('меняется вместе с шириной окна и отписывается при размонтировании', () => {
    const mm = mockMatchMedia(false);
    const { result, unmount } = renderHook(() => useIsPhone());
    expect(result.current).toBe(false);
    act(() => mm.set(true));
    expect(result.current).toBe(true);
    act(() => mm.set(false));
    expect(result.current).toBe(false);
    unmount();
    expect(mm.listenerCount()).toBe(0);
  });
});
