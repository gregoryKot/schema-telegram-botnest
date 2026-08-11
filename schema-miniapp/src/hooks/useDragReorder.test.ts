// @vitest-environment jsdom
// useDragReorder — pointer-жест ручки и клавиатура. jsdom не реализует
// setPointerCapture — мокаем на элементе, как в Slider.test.tsx (единственный
// прецедент pointer-жеста в проекте). Без зарегистрированных строк (registerRow)
// высоты падают на DEFAULT_ROW_HEIGHT=56 — пороги ниже кратны 56/2+56/2=56.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDragReorder } from './useDragReorder';

vi.mock('../haptic', () => ({
  haptic: { tap: vi.fn(), select: vi.fn() },
}));
import { haptic } from '../haptic';
const mockHaptic = haptic as unknown as Record<
  string,
  ReturnType<typeof vi.fn>
>;

beforeEach(() => vi.clearAllMocks());

function fakeHandle() {
  return { setPointerCapture: vi.fn() } as unknown as HTMLDivElement;
}

describe('useDragReorder — pointer', () => {
  const ids = ['a', 'b', 'c'];

  it('pointerdown ставит drag-состояние и шлёт haptic.tap()', () => {
    const onReorder = vi.fn();
    const { result } = renderHook(() => useDragReorder({ ids, onReorder }));
    const handle = fakeHandle();
    act(() => {
      result.current.handleProps('a', 'A', { min: 0, max: 2 }).onPointerDown({
        clientY: 0,
        pointerId: 1,
        stopPropagation: vi.fn(),
        currentTarget: handle,
      } as never);
    });
    expect(result.current.drag).toEqual({
      id: 'a',
      startIndex: 0,
      offsetY: 0,
      targetIndex: 0,
    });
    expect(handle.setPointerCapture).toHaveBeenCalledWith(1);
    expect(mockHaptic.tap).toHaveBeenCalledTimes(1);
  });

  it('pointermove вниз через порог (56px) двигает targetIndex и шлёт haptic.select() один раз', () => {
    const onReorder = vi.fn();
    const { result } = renderHook(() => useDragReorder({ ids, onReorder }));
    const props = () =>
      result.current.handleProps('a', 'A', { min: 0, max: 2 });
    act(() =>
      props().onPointerDown({
        clientY: 0,
        pointerId: 1,
        stopPropagation: vi.fn(),
        currentTarget: fakeHandle(),
      } as never),
    );
    act(() =>
      props().onPointerMove({
        clientY: 30,
        pointerId: 1,
        buttons: 1,
        stopPropagation: vi.fn(),
      } as never),
    );
    expect(result.current.drag?.targetIndex).toBe(0);
    expect(mockHaptic.select).not.toHaveBeenCalled();
    act(() =>
      props().onPointerMove({
        clientY: 60,
        pointerId: 1,
        buttons: 1,
        stopPropagation: vi.fn(),
      } as never),
    );
    expect(result.current.drag?.targetIndex).toBe(1);
    expect(mockHaptic.select).toHaveBeenCalledTimes(1);
  });

  it('pointermove без нажатой кнопки (buttons=0) не двигает', () => {
    const onReorder = vi.fn();
    const { result } = renderHook(() => useDragReorder({ ids, onReorder }));
    const props = () =>
      result.current.handleProps('a', 'A', { min: 0, max: 2 });
    act(() =>
      props().onPointerDown({
        clientY: 0,
        pointerId: 1,
        stopPropagation: vi.fn(),
        currentTarget: fakeHandle(),
      } as never),
    );
    act(() =>
      props().onPointerMove({
        clientY: 60,
        pointerId: 1,
        buttons: 0,
        stopPropagation: vi.fn(),
      } as never),
    );
    expect(result.current.drag?.targetIndex).toBe(0);
  });

  it('drag «вниз через одну» и отпускание — commit onReorder(id, toIndex) с верным индексом', () => {
    const onReorder = vi.fn();
    const { result } = renderHook(() => useDragReorder({ ids, onReorder }));
    const props = () =>
      result.current.handleProps('a', 'A', { min: 0, max: 2 });
    act(() =>
      props().onPointerDown({
        clientY: 0,
        pointerId: 1,
        stopPropagation: vi.fn(),
        currentTarget: fakeHandle(),
      } as never),
    );
    act(() =>
      props().onPointerMove({
        clientY: 112,
        pointerId: 1,
        buttons: 1,
        stopPropagation: vi.fn(),
      } as never),
    );
    expect(result.current.drag?.targetIndex).toBe(2);
    act(() =>
      props().onPointerUp({
        clientY: 112,
        pointerId: 1,
        stopPropagation: vi.fn(),
      } as never),
    );
    expect(onReorder).toHaveBeenCalledWith('a', 2);
    expect(result.current.drag).toBeNull();
  });

  it('возврат на исходное место перед отпусканием — onReorder НЕ вызван', () => {
    const onReorder = vi.fn();
    const { result } = renderHook(() => useDragReorder({ ids, onReorder }));
    const props = () =>
      result.current.handleProps('a', 'A', { min: 0, max: 2 });
    act(() =>
      props().onPointerDown({
        clientY: 0,
        pointerId: 1,
        stopPropagation: vi.fn(),
        currentTarget: fakeHandle(),
      } as never),
    );
    act(() =>
      props().onPointerMove({
        clientY: 60,
        pointerId: 1,
        buttons: 1,
        stopPropagation: vi.fn(),
      } as never),
    );
    act(() =>
      props().onPointerMove({
        clientY: 0,
        pointerId: 1,
        buttons: 1,
        stopPropagation: vi.fn(),
      } as never),
    );
    act(() =>
      props().onPointerUp({
        clientY: 0,
        pointerId: 1,
        stopPropagation: vi.fn(),
      } as never),
    );
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('pointercancel сбрасывает drag без onReorder', () => {
    const onReorder = vi.fn();
    const { result } = renderHook(() => useDragReorder({ ids, onReorder }));
    const props = () =>
      result.current.handleProps('a', 'A', { min: 0, max: 2 });
    act(() =>
      props().onPointerDown({
        clientY: 0,
        pointerId: 1,
        stopPropagation: vi.fn(),
        currentTarget: fakeHandle(),
      } as never),
    );
    act(() =>
      props().onPointerMove({
        clientY: 60,
        pointerId: 1,
        buttons: 1,
        stopPropagation: vi.fn(),
      } as never),
    );
    act(() => props().onPointerCancel({ stopPropagation: vi.fn() } as never));
    expect(result.current.drag).toBeNull();
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('диапазон [min,max] — drag за границу группы прижимается к границе', () => {
    const onReorder = vi.fn();
    const { result } = renderHook(() =>
      useDragReorder({ ids: ['a', 'b', 'c', 'd'], onReorder }),
    );
    // Строка 'b' (индекс 1) в группе [0,1] — вниз дальше индекса 1 нельзя.
    const props = () =>
      result.current.handleProps('b', 'B', { min: 0, max: 1 });
    act(() =>
      props().onPointerDown({
        clientY: 0,
        pointerId: 1,
        stopPropagation: vi.fn(),
        currentTarget: fakeHandle(),
      } as never),
    );
    act(() =>
      props().onPointerMove({
        clientY: 1000,
        pointerId: 1,
        buttons: 1,
        stopPropagation: vi.fn(),
      } as never),
    );
    expect(result.current.drag?.targetIndex).toBe(1);
    act(() =>
      props().onPointerUp({
        clientY: 1000,
        pointerId: 1,
        stopPropagation: vi.fn(),
      } as never),
    );
    expect(onReorder).not.toHaveBeenCalled();
  });
});

describe('useDragReorder — клавиатура', () => {
  const ids = ['a', 'b', 'c'];

  it('ArrowDown вызывает onReorder(id, index+1) и haptic.select()', () => {
    const onReorder = vi.fn();
    const { result } = renderHook(() => useDragReorder({ ids, onReorder }));
    const handleProps = result.current.handleProps('a', 'A', {
      min: 0,
      max: 2,
    });
    act(() =>
      handleProps.onKeyDown({
        key: 'ArrowDown',
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as never),
    );
    expect(onReorder).toHaveBeenCalledWith('a', 1);
    expect(mockHaptic.select).toHaveBeenCalledTimes(1);
  });

  it('ArrowUp на границе диапазона (min) — no-op, onReorder не вызван', () => {
    const onReorder = vi.fn();
    const { result } = renderHook(() => useDragReorder({ ids, onReorder }));
    const handleProps = result.current.handleProps('a', 'A', {
      min: 0,
      max: 2,
    });
    act(() =>
      handleProps.onKeyDown({
        key: 'ArrowUp',
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as never),
    );
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('ArrowDown прижат к max диапазона (граница группы)', () => {
    const onReorder = vi.fn();
    const { result } = renderHook(() => useDragReorder({ ids, onReorder }));
    // 'b' (индекс 1) в группе [0,1] — ArrowDown не пускает на индекс 2.
    const handleProps = result.current.handleProps('b', 'B', {
      min: 0,
      max: 1,
    });
    act(() =>
      handleProps.onKeyDown({
        key: 'ArrowDown',
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as never),
    );
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('прочие клавиши игнорируются', () => {
    const onReorder = vi.fn();
    const { result } = renderHook(() => useDragReorder({ ids, onReorder }));
    const handleProps = result.current.handleProps('a', 'A', {
      min: 0,
      max: 2,
    });
    const preventDefault = vi.fn();
    act(() =>
      handleProps.onKeyDown({
        key: 'Enter',
        preventDefault,
        stopPropagation: vi.fn(),
      } as never),
    );
    expect(preventDefault).not.toHaveBeenCalled();
    expect(onReorder).not.toHaveBeenCalled();
  });
});

describe('useDragReorder — aria-label', () => {
  it('aria-label — «Переставить: <название>»', () => {
    const { result } = renderHook(() =>
      useDragReorder({ ids: ['a'], onReorder: vi.fn() }),
    );
    const props = result.current.handleProps('a', 'Трекер потребностей', {
      min: 0,
      max: 0,
    });
    expect(props['aria-label']).toBe('Переставить: Трекер потребностей');
    expect(props.role).toBe('button');
    expect(props.tabIndex).toBe(0);
  });
});
