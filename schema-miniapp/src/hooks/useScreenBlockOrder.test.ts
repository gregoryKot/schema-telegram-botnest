// @vitest-environment jsdom
// Хук порядка блоков экрана: без сохранённого порядка — реестр
// SCREEN_BLOCK_ORDER, move свопает СРЕДИ ВСЕХ блоков экрана, персистит
// (read-after-write) и шлёт screen_block_move только при успехе; край —
// no-op без записи/события.
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

  it('move свопает соседей, персистит и шлёт screen_block_move (read-after-write)', () => {
    const { result } = renderHook(() => useScreenBlockOrder('profile'));
    let moved = false;
    act(() => {
      moved = result.current.move('streak', 'up');
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

  it('край (первый вверх) — false, localStorage и событие не трогает', () => {
    const { result } = renderHook(() => useScreenBlockOrder('profile'));
    let moved = true;
    act(() => {
      moved = result.current.move('journey', 'up');
    });
    expect(moved).toBe(false);
    expect(localStorage.getItem('screen_order_profile')).toBeNull();
    expect(mockApi.trackEvent).not.toHaveBeenCalled();
  });

  it('край (последний вниз) — false, событие не отправлено', () => {
    const { result } = renderHook(() => useScreenBlockOrder('patterns'));
    let moved = true;
    act(() => {
      moved = result.current.move('ysq_status', 'down');
    });
    expect(moved).toBe(false);
    expect(mockApi.trackEvent).not.toHaveBeenCalled();
  });

  it('повторный рендер хука читает сохранённый порядок (read-after-write)', () => {
    const { result, unmount } = renderHook(() =>
      useScreenBlockOrder('profile'),
    );
    act(() => {
      result.current.move('heatmap', 'up');
    });
    unmount();
    const { result: second } = renderHook(() => useScreenBlockOrder('profile'));
    expect(second.current.orderedIds).toEqual([
      'journey',
      'heatmap',
      'streak',
      'achievements',
      'insights',
    ]);
  });
});
