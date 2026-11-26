// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHeatWeeks } from './useHeatWeeks';

const setWidth = (w: number) => { Object.defineProperty(window, 'innerWidth', { configurable: true, value: w }); };
const orig = window.innerWidth;
afterEach(() => setWidth(orig));

describe('useHeatWeeks', () => {
  it('на десктопе — все 18 недель', () => {
    setWidth(1280);
    expect(renderHook(() => useHeatWeeks()).result.current).toBe(18);
  });

  it('на телефоне — меньше, и следует за поворотом экрана', () => {
    setWidth(390);
    const { result } = renderHook(() => useHeatWeeks());
    expect(result.current).toBe(14);
    act(() => { setWidth(320); window.dispatchEvent(new Event('resize')); });
    expect(result.current).toBe(11);
    act(() => { setWidth(1024); window.dispatchEvent(new Event('resize')); });
    expect(result.current).toBe(18);
  });
});
