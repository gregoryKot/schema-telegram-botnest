// @vitest-environment jsdom
// QA клиента 2026-11-03: К2 (день сервера вместо дня человека), К3 (вкладка
// через полночь), З9 (офлайн-очередь и «1 из 5» после перезагрузки).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDayRatings, type DayRatingsApi } from './useDayRatings';
import { enqueueRating } from '../utils/ratingOutbox';
import { forEachTimeZoneAsync } from '../utils/timeZone.test-helpers';

type Need = { id: string };
const NEEDS: Need[] = ['attachment', 'autonomy'].map((id) => ({ id }));

function makeApi(byDay: Record<string, Record<string, number>> = {}) {
  return {
    needs: vi.fn(() => Promise.resolve(NEEDS)),
    ratings: vi.fn((date: string) =>
      Promise.resolve({ ...(byDay[date] ?? {}) }),
    ),
  } satisfies DayRatingsApi<Need>;
}

const settle = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe('useDayRatings', () => {
  it('К2: «сегодня» и «вчера» запрашиваются днём устройства, явной датой — в любой зоне', async () => {
    await forEachTimeZoneAsync(async (tz) => {
      // 13:40 вторника по местным часам — в Москве в это время может быть среда.
      vi.setSystemTime(new Date(2026, 10, 3, 13, 40));
      const api = makeApi({ '2026-11-03': { attachment: 6 } });
      const { result, unmount } = renderHook(() => useDayRatings(api));
      await settle();
      expect(
        api.ratings.mock.calls.map((c) => c[0]),
        tz,
      ).toEqual(['2026-11-03', '2026-11-02']);
      expect(result.current.ratings, tz).toEqual({ attachment: 6 });
      expect(result.current.today, tz).toBe('2026-11-03');
      unmount();
    });
  });

  it('К3: в полночь оценки дня сбрасываются и перечитываются за новый день', async () => {
    vi.setSystemTime(new Date(2026, 10, 3, 23, 58));
    const api = makeApi({ '2026-11-03': { attachment: 6, autonomy: 6 } });
    const onLoaded = vi.fn();
    const { result } = renderHook(() => useDayRatings(api, { onLoaded }));
    await settle();
    expect(result.current.ratings).toEqual({ attachment: 6, autonomy: 6 });

    vi.setSystemTime(new Date(2026, 10, 4, 0, 2));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(result.current.today).toBe('2026-11-04');
    expect(result.current.ratings).toEqual({});
    expect(result.current.saved).toEqual({});
    expect(result.current.yesterdayRatings).toEqual({
      attachment: 6,
      autonomy: 6,
    });
    expect(api.ratings).toHaveBeenLastCalledWith('2026-11-03');
    expect(api.ratings).toHaveBeenCalledWith('2026-11-04');
    expect(onLoaded).toHaveBeenCalledTimes(1); // перечитывание — не «первая загрузка»
  });

  it('К3: касание после полуночи сменяет день до того, как дойдёт до кнопки', async () => {
    vi.setSystemTime(new Date(2026, 10, 3, 23, 59, 50));
    const api = makeApi({ '2026-11-03': { attachment: 6 } });
    const { result } = renderHook(() => useDayRatings(api));
    await settle();
    vi.setSystemTime(new Date(2026, 10, 4, 0, 0, 5));
    act(() => {
      window.dispatchEvent(new Event('pointerdown'));
    });
    expect(result.current.ratings).toEqual({});
  });

  it('К3: ответ, данный пока шёл запрос нового дня, ответ сервера не затирает', async () => {
    vi.setSystemTime(new Date(2026, 10, 3, 23, 59));
    let release: (v: Record<string, number>) => void = () => {};
    const api = makeApi();
    const { result } = renderHook(() => useDayRatings(api));
    await settle();
    api.ratings.mockImplementation((date: string) =>
      date === '2026-11-04'
        ? new Promise((r) => {
            release = r;
          })
        : Promise.resolve({}),
    );
    vi.setSystemTime(new Date(2026, 10, 4, 0, 1));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    act(() => {
      result.current.setRatings((p) => ({ ...p, attachment: 9 }));
    });
    await act(async () => {
      release({ autonomy: 4 });
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.ratings).toEqual({ autonomy: 4, attachment: 9 });
  });

  it('З9: оценки дня из офлайн-очереди лежат поверх ответа сервера', async () => {
    vi.setSystemTime(new Date(2026, 10, 3, 12, 0));
    enqueueRating({ needId: 'autonomy', value: 8, date: '2026-11-03' });
    enqueueRating({ needId: 'autonomy', value: 2, date: '2026-11-01' });
    const api = makeApi({ '2026-11-03': { attachment: 6 } });
    const { result } = renderHook(() => useDayRatings(api));
    await settle();
    expect(result.current.ratings).toEqual({ attachment: 6, autonomy: 8 });
    expect(result.current.saved).toEqual({ attachment: true, autonomy: true });
    // День заполнен — праздник за этот день больше не показывается.
    expect(localStorage.getItem('celebrated_2026-11-03')).toBe('1');
  });

  it('сбой первой загрузки и сбой в полночь различаются (initial)', async () => {
    vi.setSystemTime(new Date(2026, 10, 3, 23, 59));
    const api = makeApi();
    api.ratings.mockRejectedValue(new Error('down'));
    const onError = vi.fn();
    const { result } = renderHook(() => useDayRatings(api, { onError }));
    await settle();
    expect(onError).toHaveBeenLastCalledWith(expect.any(Error), true);
    expect(result.current.loading).toBe(false);
    vi.setSystemTime(new Date(2026, 10, 4, 0, 1));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(onError).toHaveBeenLastCalledWith(expect.any(Error), false);
  });
});
