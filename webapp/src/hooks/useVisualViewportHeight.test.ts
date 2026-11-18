// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useVisualViewportHeight } from './useVisualViewportHeight';

function stubViewport(height: number) {
  const vv = Object.assign(new EventTarget(), { height, offsetTop: 0 });
  vi.stubGlobal('visualViewport', vv);
  return vv;
}

afterEach(() => vi.unstubAllGlobals());

describe('useVisualViewportHeight', () => {
  it('нет visualViewport — null', () => {
    vi.stubGlobal('visualViewport', undefined);
    expect(renderHook(() => useVisualViewportHeight()).result.current).toBeNull();
  });

  it('высота и сдвиг обновляются по resize; после размонтирования подписки нет', () => {
    const vv = stubViewport(800);
    const remove = vi.spyOn(vv, 'removeEventListener');
    const { result, unmount } = renderHook(() => useVisualViewportHeight());
    expect(result.current).toEqual({ height: 800, offsetTop: 0 });
    act(() => { Object.assign(vv, { height: 420.4, offsetTop: 12 }); vv.dispatchEvent(new Event('resize')); });
    expect(result.current).toEqual({ height: 420, offsetTop: 12 });
    unmount();
    expect(remove.mock.calls.map((c) => c[0]).sort()).toEqual(['resize', 'scroll']);
  });
});
