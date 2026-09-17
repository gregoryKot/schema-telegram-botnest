// @vitest-environment jsdom
// Хук настройки экрана «Сегодня» — читает 0% покрытия целиком (собирает
// восемь useState + обработчики, вынесенные из TodaySection, правило №10).
// Тестируем именно связку toggle → localStorage → следующий рендер хука
// видит сохранённое (read-after-write), а не только факт вызова сеттера.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTodayCustomization } from './useTodayCustomization';

vi.mock('../api', () => ({
  api: { trackEvent: vi.fn() },
}));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('useTodayCustomization — открытие листа настройки', () => {
  it('шестерёнка открывает лист без подсветки конкретного блока', () => {
    const { result } = renderHook(() => useTodayCustomization());
    act(() => result.current.openByGear());
    expect(result.current.sheet).toBe(true);
    expect(result.current.highlight).toBeUndefined();
    expect(mockApi.trackEvent).toHaveBeenCalledWith('today_customize_open', {
      via: 'gear',
    });
  });

  it('closeSheet закрывает лист', () => {
    const { result } = renderHook(() => useTodayCustomization());
    act(() => result.current.openByGear());
    act(() => result.current.closeSheet());
    expect(result.current.sheet).toBeNull();
  });
});

describe('useTodayCustomization — переключение блоков (read-after-write)', () => {
  it('toggleStreak меняет флаг и сохраняет его — новый инстанс хука видит сохранённое', () => {
    const { result, unmount } = renderHook(() => useTodayCustomization());
    expect(result.current.streakHidden).toBe(false);
    act(() => result.current.toggleStreak());
    expect(result.current.streakHidden).toBe(true);
    expect(mockApi.trackEvent).toHaveBeenCalledWith('today_block_toggle', {
      block: 'streak',
      hidden: true,
    });
    unmount();
    // Новый рендер хука (как при перезаходе на экран) обязан прочитать то,
    // что реально сохранено, а не сброситься на дефолт.
    const { result: second } = renderHook(() => useTodayCustomization());
    expect(second.current.streakHidden).toBe(true);
  });

  it('toggleTherapistBanner переключает баннер терапевта', () => {
    const { result } = renderHook(() => useTodayCustomization());
    expect(result.current.therapistBannerHidden).toBe(false);
    act(() => result.current.toggleTherapistBanner());
    expect(result.current.therapistBannerHidden).toBe(true);
  });

  it('choosePractice сохраняет выбранную практику и трекает событие', () => {
    const { result } = renderHook(() => useTodayCustomization());
    act(() => result.current.choosePractice('gratitude'));
    expect(result.current.practice).toBe('gratitude');
    expect(mockApi.trackEvent).toHaveBeenCalledWith('today_focus_change', {
      practice: 'gratitude',
    });
  });
});

describe('useTodayCustomization — порядок блоков (screen_order_today)', () => {
  it('дефолтный порядок band — как в реестре SCREEN_BLOCK_ORDER.today', () => {
    const { result } = renderHook(() => useTodayCustomization());
    expect(result.current.orderedIds).toEqual([
      'therapist_banner',
      'streak',
      'focus',
      'phrase',
      'secondary',
    ]);
  });

  it('сохранённый порядок применяется при следующем рендере хука', () => {
    localStorage.setItem(
      'screen_order_today',
      JSON.stringify(['phrase', 'focus']),
    );
    const { result } = renderHook(() => useTodayCustomization());
    // Из порядка — первыми, остальные следом в порядке реестра (stable).
    expect(result.current.orderedIds).toEqual([
      'phrase',
      'focus',
      'therapist_banner',
      'streak',
      'secondary',
    ]);
  });

  it('reorder перса порядок (read-after-write) и шлёт screen_block_move с screen=today', () => {
    const { result, unmount } = renderHook(() => useTodayCustomization());
    let moved = false;
    act(() => {
      moved = result.current.reorder('phrase', 0);
    });
    expect(moved).toBe(true);
    expect(result.current.orderedIds[0]).toBe('phrase');
    expect(mockApi.trackEvent).toHaveBeenCalledWith('screen_block_move', {
      screen: 'today',
      block: 'phrase',
      dir: 'up',
    });
    unmount();
    const { result: second } = renderHook(() => useTodayCustomization());
    expect(second.current.orderedIds[0]).toBe('phrase');
  });

  it('reorder по видимому подмножеству (без баннера терапевта) не ломает порядок', () => {
    const { result } = renderHook(() => useTodayCustomization());
    // Не-терапевт: строка therapist_banner в листе не показана.
    const visible = result.current.orderedIds.filter(
      (id) => id !== 'therapist_banner',
    );
    let moved = false;
    act(() => {
      // streak (индекс 0 среди видимых) — в конец видимых.
      moved = result.current.reorder('streak', visible.length - 1, visible);
    });
    expect(moved).toBe(true);
    expect(result.current.orderedIds.indexOf('streak')).toBeGreaterThan(
      result.current.orderedIds.indexOf('secondary'),
    );
  });
});
