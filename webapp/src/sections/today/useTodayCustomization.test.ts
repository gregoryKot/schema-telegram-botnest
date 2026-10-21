// @vitest-environment jsdom
// Хук «Сегодня» сайта: долгое нажатие на блок — только на телефоне и открывает
// лист с подсветкой строки блока (как в мини-аппе).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTodayCustomization } from './useTodayCustomization';

const isMobile = vi.hoisted(() => ({ value: true }));
vi.mock('../../components/useIsMobile', () => ({ useIsMobile: () => isMobile.value }));
vi.mock('../../api', () => ({ api: { trackEvent: vi.fn() } }));
import { api } from '../../api';
const track = api.trackEvent as unknown as ReturnType<typeof vi.fn>;

const down = { button: 0, isPrimary: true, clientX: 0, clientY: 0 } as never;

beforeEach(() => { vi.useFakeTimers(); localStorage.clear(); track.mockClear(); isMobile.value = true; });
afterEach(() => vi.useRealTimers());

describe('useTodayCustomization (сайт)', () => {
  it.each([
    ['holdFocus', 'practice'],
    ['holdStreak', 'streak'],
    ['holdPhrase', 'phrase'],
  ] as const)('%s: удержание открывает лист с подсветкой «%s»', (hold, highlight) => {
    const { result } = renderHook(() => useTodayCustomization());
    act(() => { result.current[hold]?.onPointerDown(down); });
    act(() => { vi.advanceTimersByTime(500); });
    expect(result.current.sheet).toBe(highlight);
    expect(result.current.highlight).toBe(highlight);
    expect(track).toHaveBeenCalledWith('today_customize_open', { via: 'longpress' });
  });

  it('на десктопе жеста нет: правый клик по карточкам остаётся обычным', () => {
    isMobile.value = false;
    const { result } = renderHook(() => useTodayCustomization());
    expect(result.current.holdFocus).toBeUndefined();
    expect(result.current.holdStreak).toBeUndefined();
    expect(result.current.holdPhrase).toBeUndefined();
  });
});
