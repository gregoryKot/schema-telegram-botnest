// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCardFontsReady } from './useCardFonts';
import { resetCardFontsForTest } from './kit/paperFrame';

afterEach(() => {
  vi.useRealTimers();
  resetCardFontsForTest();
  Reflect.deleteProperty(document, 'fonts');
});

function stubFonts(loadedAfterMs: number) {
  let loaded = false;
  const ready = new Promise<void>((r) =>
    setTimeout(() => {
      loaded = true;
      r();
    }, loadedAfterMs),
  );
  const load = vi.fn(() =>
    loaded ? Promise.resolve([{}]) : new Promise<never>(() => {}),
  );
  Object.defineProperty(document, 'fonts', {
    value: { load, ready },
    configurable: true,
  });
}

describe('useCardFontsReady', () => {
  it('шрифты не успели за тайм-аут — флаг встаёт, когда браузер их всё же догрузил (карточку перерисуют)', async () => {
    vi.useFakeTimers();
    stubFonts(2500);
    const { result } = renderHook(() => useCardFontsReady());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });
    expect(result.current).toBe(false);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(result.current).toBe(true);
  });

  it('без document.fonts (старый браузер) — флаг остаётся false, без падения', async () => {
    const { result } = renderHook(() => useCardFontsReady());
    await act(async () => {});
    expect(result.current).toBe(false);
  });
});
