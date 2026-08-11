// @vitest-environment jsdom
// Хук порядка блоков экрана: без сохранённого порядка — реестр
// SCREEN_BLOCK_ORDER, reorder переставляет СРЕДИ ВСЕХ блоков экрана,
// персистит (read-after-write) и шлёт screen_block_move только при успехе;
// no-op (toIndex не меняет позицию) — без записи/события.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useScreenBlockOrder } from './useScreenBlockOrder';

vi.mock('../api', () => ({ api: { trackEvent: vi.fn() } }));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('useScreenBlockOrder', () => {
  it('без сохранённого порядка — порядок реестра SCREEN_BLOCK_ORDER', () => {
    const { result } = renderHook(() => useScreenBlockOrder('profile'));
    expect(result.current.orderedIds).toEqual([
      'journey',
      'streak',
      'heatmap',
      'achievements',
      'insights',
    ]);
  });

  it('«Паттерны» и «Профиль» не задевают друг друга', () => {
    const { result } = renderHook(() => useScreenBlockOrder('patterns'));
    expect(result.current.orderedIds).toEqual(['heroes', 'ysq_status']);
  });

  it('reorder переставляет, персистит и шлёт screen_block_move с dir="up" (read-after-write)', () => {
    const { result } = renderHook(() => useScreenBlockOrder('profile'));
    let moved = false;
    act(() => {
      moved = result.current.reorder('streak', 0);
    });
    expect(moved).toBe(true);
    expect(result.current.orderedIds[0]).toBe('streak');
    expect(result.current.orderedIds[1]).toBe('journey');
    expect(localStorage.getItem('screen_order_profile')).toBe(
      JSON.stringify([
        'streak',
        'journey',
        'heatmap',
        'achievements',
        'insights',
      ]),
    );
    expect(mockApi.trackEvent).toHaveBeenCalledWith('screen_block_move', {
      screen: 'profile',
      block: 'streak',
      dir: 'up',
    });
  });

  it('reorder на больший индекс шлёт dir="down"', () => {
    const { result } = renderHook(() => useScreenBlockOrder('profile'));
    act(() => {
      result.current.reorder('journey', 2);
    });
    expect(mockApi.trackEvent).toHaveBeenCalledWith('screen_block_move', {
      screen: 'profile',
      block: 'journey',
      dir: 'down',
    });
  });

  it('toIndex === текущий индекс — false, localStorage и событие не трогает', () => {
    const { result } = renderHook(() => useScreenBlockOrder('profile'));
    let moved = true;
    act(() => {
      moved = result.current.reorder('journey', 0);
    });
    expect(moved).toBe(false);
    expect(localStorage.getItem('screen_order_profile')).toBeNull();
    expect(mockApi.trackEvent).not.toHaveBeenCalled();
  });

  it('toIndex за пределом списка клэмпится к последней позиции — событие не отправлено, если итог не изменился', () => {
    const { result } = renderHook(() => useScreenBlockOrder('patterns'));
    let moved = true;
    act(() => {
      // 'ysq_status' уже последний (индекс 1) — клэмп к 1 не меняет позицию.
      moved = result.current.reorder('ysq_status', 999);
    });
    expect(moved).toBe(false);
    expect(mockApi.trackEvent).not.toHaveBeenCalled();
  });

  it('повторный рендер хука читает сохранённый порядок (read-after-write)', () => {
    const { result, unmount } = renderHook(() =>
      useScreenBlockOrder('profile'),
    );
    act(() => {
      result.current.reorder('heatmap', 0);
    });
    unmount();
    const { result: second } = renderHook(() => useScreenBlockOrder('profile'));
    expect(second.current.orderedIds).toEqual([
      'heatmap',
      'journey',
      'streak',
      'achievements',
      'insights',
    ]);
  });
});
