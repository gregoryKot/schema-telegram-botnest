// @vitest-environment jsdom
// useOnVisible — тикает true, когда узел показался во вьюпорте (мокаем
// IntersectionObserver и дёргаем callback вручную — jsdom его не реализует).
// Фолбэк без API — становится видимым сразу, чтобы карточка не осталась
// пустой навсегда на старом WebView (см. HeatmapCard.tsx).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOnVisible } from './useOnVisible';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useOnVisible — без IntersectionObserver (фолбэк)', () => {
  it('становится видимым сразу, если API недоступен', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const { result } = renderHook(() => useOnVisible<HTMLDivElement>());
    // Реф ещё не подключён к элементу в renderHook (нет реального DOM-узла),
    // фолбэк без API срабатывает независимо от этого — видимость сразу true.
    expect(result.current.visible).toBe(true);
  });
});

describe('useOnVisible — с IntersectionObserver', () => {
  it('видимость остаётся false, пока наблюдатель не сообщит isIntersecting', () => {
    const observe = vi.fn();
    const disconnect = vi.fn();
    let capturedCallback: IntersectionObserverCallback | null = null;
    class FakeObserver {
      constructor(cb: IntersectionObserverCallback) {
        capturedCallback = cb;
      }
      observe = observe;
      disconnect = disconnect;
      unobserve = vi.fn();
      takeRecords = vi.fn(() => []);
      root = null;
      rootMargin = '';
      thresholds: number[] = [];
    }
    vi.stubGlobal('IntersectionObserver', FakeObserver);

    const { result, rerender } = renderHook(() => {
      const { ref, visible } = useOnVisible<HTMLDivElement>();
      // Подключаем реф к настоящему узлу, чтобы эффект нашёл node.
      if (!ref.current) ref.current = document.createElement('div');
      return { ref, visible };
    });

    expect(result.current.visible).toBe(false);
    expect(observe).toHaveBeenCalledTimes(1);

    act(() => {
      capturedCallback!(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });
    rerender();
    expect(result.current.visible).toBe(true);
  });
});
