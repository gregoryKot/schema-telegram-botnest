// @vitest-environment jsdom
// useProfileStats — стрик/ачивки/инсайты вкладки «Я» с независимым ready
// на каждый источник (замер 2026-08-22, ProfileSection.tsx: единый
// Promise.all держал экран пустым до самого долгого ответа, 1321мс).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useProfileStats } from './useProfileStats';

vi.mock('../../api', () => ({
  api: {
    getStreak: vi.fn(),
    getAchievements: vi.fn(),
    getInsights: vi.fn(),
  },
}));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

afterEach(() => {
  vi.clearAllMocks();
});

function pending<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useProfileStats — одна волна', () => {
  it('все три запроса уходят синхронно при монтировании (без ожидания друг друга)', () => {
    mockApi.getStreak.mockReturnValue(new Promise(() => {}));
    mockApi.getAchievements.mockReturnValue(new Promise(() => {}));
    mockApi.getInsights.mockReturnValue(new Promise(() => {}));
    renderHook(() => useProfileStats());
    expect(mockApi.getStreak).toHaveBeenCalledTimes(1);
    expect(mockApi.getAchievements).toHaveBeenCalledTimes(1);
    expect(mockApi.getInsights).toHaveBeenCalledTimes(1);
  });
});

describe('useProfileStats — прогрессивная готовность', () => {
  it('achievementsReady встаёт независимо, пока streak/insights ещё летят', async () => {
    const streakP = pending<unknown>();
    const insightsP = pending<unknown>();
    mockApi.getStreak.mockReturnValue(streakP.promise);
    mockApi.getInsights.mockReturnValue(insightsP.promise);
    mockApi.getAchievements.mockResolvedValue([
      { id: 'first_day', earned: true },
    ]);

    const { result } = renderHook(() => useProfileStats());
    await waitFor(() => expect(result.current.achievementsReady).toBe(true));

    expect(result.current.streakReady).toBe(false);
    expect(result.current.insightsReady).toBe(false);
    expect(result.current.achievements).toEqual([
      { id: 'first_day', earned: true },
    ]);

    streakP.resolve({
      currentStreak: 1,
      longestStreak: 1,
      totalDays: 1,
      todayDone: true,
      weekDots: [],
    });
    insightsP.resolve({
      weeklyStats: [],
      bestDayOfWeek: null,
      worstDayOfWeek: null,
      totalDays: 1,
    });
    await waitFor(() => expect(result.current.streakReady).toBe(true));
    await waitFor(() => expect(result.current.insightsReady).toBe(true));
  });

  it('провал одного источника не мешает остальным дойти до ready (regression: check-silent-catch)', async () => {
    mockApi.getStreak.mockRejectedValue(new Error('network'));
    mockApi.getAchievements.mockResolvedValue([]);
    mockApi.getInsights.mockResolvedValue({
      weeklyStats: [],
      bestDayOfWeek: null,
      worstDayOfWeek: null,
      totalDays: 0,
    });

    const { result } = renderHook(() => useProfileStats());
    await waitFor(() => expect(result.current.streakReady).toBe(true));
    await waitFor(() => expect(result.current.achievementsReady).toBe(true));
    await waitFor(() => expect(result.current.insightsReady).toBe(true));
    expect(result.current.streak).toBeNull();
    expect(result.current.achievements).toEqual([]);
  });

  it('провал рефетча не подменяет реальный стрик нулём — данные не обнуляются перед повтором', async () => {
    mockApi.getStreak.mockResolvedValueOnce({
      currentStreak: 5,
      longestStreak: 8,
      totalDays: 12,
      todayDone: true,
      weekDots: [],
    });
    mockApi.getAchievements.mockResolvedValue([]);
    mockApi.getInsights.mockResolvedValue({
      weeklyStats: [],
      bestDayOfWeek: null,
      worstDayOfWeek: null,
      totalDays: 0,
    });

    const { result, rerender } = renderHook(
      ({ refreshKey }) => useProfileStats(refreshKey),
      { initialProps: { refreshKey: 1 } },
    );
    await waitFor(() => expect(result.current.streak?.totalDays).toBe(12));

    mockApi.getStreak.mockRejectedValueOnce(new Error('network'));
    rerender({ refreshKey: 2 });
    await waitFor(() => expect(mockApi.getStreak).toHaveBeenCalledTimes(2));
    expect(result.current.streak?.totalDays).toBe(12);
  });
});

describe('useProfileStats — hasInsights', () => {
  it('true только если хотя бы одна потребность имеет реальный avg (не выдумка на чистом аккаунте)', async () => {
    mockApi.getStreak.mockResolvedValue({
      currentStreak: 0,
      longestStreak: 0,
      totalDays: 0,
      todayDone: false,
      weekDots: [],
    });
    mockApi.getAchievements.mockResolvedValue([]);
    mockApi.getInsights.mockResolvedValue({
      weeklyStats: [{ needId: 'safety', avg: null, trend: '→' }],
      bestDayOfWeek: null,
      worstDayOfWeek: null,
      totalDays: 0,
    });
    const { result } = renderHook(() => useProfileStats());
    await waitFor(() => expect(result.current.insightsReady).toBe(true));
    expect(result.current.hasInsights).toBe(false);
  });
});
