// @vitest-environment jsdom
// Локальные слои «Назад» (hooks/backLayers.ts): стек, порядок, снятие при
// размонтировании, свежесть замыкания close.
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  pushBackLayer,
  useBackLayer,
  useTopBackLayerClose,
} from './backLayers';

describe('backLayers — стек', () => {
  it('без слоёв верхнего нет', () => {
    const { result } = renderHook(() => useTopBackLayerClose());
    expect(result.current).toBeNull();
  });

  it('верхний слой — последний поставленный; снятие открывает нижний', () => {
    const lower = vi.fn();
    const upper = vi.fn();
    const { result } = renderHook(() => useTopBackLayerClose());

    let dropLower = () => {};
    let dropUpper = () => {};
    act(() => {
      dropLower = pushBackLayer(lower);
      dropUpper = pushBackLayer(upper);
    });
    act(() => result.current!());
    expect(upper).toHaveBeenCalledTimes(1);
    expect(lower).not.toHaveBeenCalled();

    act(() => dropUpper());
    act(() => result.current!());
    expect(lower).toHaveBeenCalledTimes(1);

    act(() => dropLower());
    expect(result.current).toBeNull();
  });

  it('снятие идемпотентно: повторный вызов не трогает чужие слои', () => {
    const a = vi.fn();
    const b = vi.fn();
    const { result } = renderHook(() => useTopBackLayerClose());
    let dropA = () => {};
    let dropB = () => {};
    act(() => {
      dropA = pushBackLayer(a);
      dropB = pushBackLayer(b);
    });
    act(() => dropA());
    act(() => dropA());
    act(() => result.current!());
    expect(b).toHaveBeenCalledTimes(1);
    expect(result.current).not.toBeNull();
    act(() => dropB());
    expect(result.current).toBeNull();
  });
});

describe('useBackLayer', () => {
  it('слой стоит, пока компонент смонтирован, и снимается при размонтировании', () => {
    const { result } = renderHook(() => useTopBackLayerClose());
    const layer = renderHook(() => useBackLayer(() => {}));
    expect(result.current).not.toBeNull();

    layer.unmount();
    expect(result.current).toBeNull();
  });

  it('вызывает СВЕЖИЙ close, а не замыкание первого рендера', () => {
    const first = vi.fn();
    const second = vi.fn();
    const top = renderHook(() => useTopBackLayerClose());
    const layer = renderHook(({ close }) => useBackLayer(close), {
      initialProps: { close: first },
    });
    layer.rerender({ close: second });

    act(() => top.result.current!());

    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
    layer.unmount();
  });

  it('два вложенных слоя: «Назад» закрывает верхний, потом нижний', () => {
    const outer = vi.fn();
    const inner = vi.fn();
    const top = renderHook(() => useTopBackLayerClose());
    const o = renderHook(() => useBackLayer(outer));
    const i = renderHook(() => useBackLayer(inner));

    act(() => top.result.current!());
    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();

    i.unmount();
    act(() => top.result.current!());
    expect(outer).toHaveBeenCalledTimes(1);
    o.unmount();
  });
});
