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
