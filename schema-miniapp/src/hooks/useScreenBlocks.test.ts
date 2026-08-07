// @vitest-environment jsdom
// Generic-хук скрытия блоков экрана — читаем связку toggle → localStorage →
// следующий рендер хука видит сохранённое (read-after-write), не только факт
// вызова сеттера. Отдельно проверяем оба способа открыть лист (шестерёнка/
// долгое нажатие) и что holdProps('id') реально запускает нужный блок.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useScreenBlocks } from './useScreenBlocks';

vi.mock('../api', () => ({ api: { trackEvent: vi.fn() } }));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe('useScreenBlocks — открытие листа', () => {
  it('openByGear открывает лист без подсветки, шлёт via=gear', () => {
    const { result } = renderHook(() =>
      useScreenBlocks('profile', 'screen_hidden_profile'),
    );
    act(() => result.current.openByGear());
    expect(result.current.sheet).toBe(true);
    expect(result.current.highlight).toBeUndefined();
    expect(mockApi.trackEvent).toHaveBeenCalledWith('screen_customize_open', {
      screen: 'profile',
      via: 'gear',
    });
  });

  it('openByHold(id) подсвечивает блок, шлёт via=longpress', () => {
    const { result } = renderHook(() =>
      useScreenBlocks('profile', 'screen_hidden_profile'),
    );
    act(() => result.current.openByHold('streak'));
    expect(result.current.sheet).toBe('streak');
    expect(result.current.highlight).toBe('streak');
    expect(mockApi.trackEvent).toHaveBeenCalledWith('screen_customize_open', {
      screen: 'profile',
      via: 'longpress',
    });
  });

  it('closeSheet закрывает лист', () => {
    const { result } = renderHook(() =>
      useScreenBlocks('profile', 'screen_hidden_profile'),
    );
    act(() => result.current.openByGear());
    act(() => result.current.closeSheet());
    expect(result.current.sheet).toBeNull();
  });

  it('долгое нажатие через holdProps(id) открывает лист именно с этим id', () => {
    const { result } = renderHook(() =>
      useScreenBlocks('profile', 'screen_hidden_profile'),
    );
    act(() => {
      result.current.holdProps('achievements').onPointerDown({
        button: 0,
        isPrimary: true,
        clientX: 0,
        clientY: 0,
      } as never);
      vi.advanceTimersByTime(500);
    });
    expect(result.current.sheet).toBe('achievements');
    expect(mockApi.trackEvent).toHaveBeenCalledWith('screen_customize_open', {
      screen: 'profile',
      via: 'longpress',
    });
  });
});

describe('useScreenBlocks — toggle (read-after-write)', () => {
  it('по умолчанию ничего не скрыто', () => {
    const { result } = renderHook(() =>
      useScreenBlocks('profile', 'screen_hidden_profile'),
    );
    expect(result.current.hidden).toEqual([]);
    expect(result.current.isHidden('streak')).toBe(false);
  });

  it('toggle скрывает блок, пишет localStorage и шлёт screen_block_toggle', () => {
    const { result } = renderHook(() =>
      useScreenBlocks('profile', 'screen_hidden_profile'),
    );
    act(() => result.current.toggle('streak'));
    expect(result.current.hidden).toEqual(['streak']);
    expect(result.current.isHidden('streak')).toBe(true);
    expect(localStorage.getItem('screen_hidden_profile')).toBe('["streak"]');
    expect(mockApi.trackEvent).toHaveBeenCalledWith('screen_block_toggle', {
      screen: 'profile',
      block: 'streak',
      hidden: true,
    });
  });

  it('повторный toggle возвращает блок обратно', () => {
    const { result } = renderHook(() =>
      useScreenBlocks('profile', 'screen_hidden_profile'),
    );
    act(() => result.current.toggle('streak'));
    act(() => result.current.toggle('streak'));
    expect(result.current.hidden).toEqual([]);
    expect(mockApi.trackEvent).toHaveBeenLastCalledWith('screen_block_toggle', {
      screen: 'profile',
      block: 'streak',
      hidden: false,
    });
  });

  it('новый рендер хука читает сохранённое (read-after-write)', () => {
    const { result, unmount } = renderHook(() =>
      useScreenBlocks('profile', 'screen_hidden_profile'),
    );
    act(() => result.current.toggle('heatmap'));
    unmount();
    const { result: second } = renderHook(() =>
      useScreenBlocks('profile', 'screen_hidden_profile'),
    );
    expect(second.current.hidden).toEqual(['heatmap']);
  });

  it('ключи разных экранов не задевают друг друга', () => {
    const { result: profile } = renderHook(() =>
      useScreenBlocks('profile', 'screen_hidden_profile'),
    );
    act(() => profile.current.toggle('streak'));
    const { result: patterns } = renderHook(() =>
      useScreenBlocks('patterns', 'screen_hidden_patterns'),
    );
    expect(patterns.current.hidden).toEqual([]);
  });
});
