// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../api', () => ({
  api: { saveRating: vi.fn() },
  reportClientError: vi.fn(),
}));
import { api, reportClientError } from '../api';
import { useRatingSaver } from './useRatingSaver';

const save = api.saveRating as unknown as ReturnType<typeof vi.fn>;
const base = { errorMessage: 'rating save failed', section: 'today' };

beforeEach(() => {
  vi.useFakeTimers();
  save.mockReset();
  (reportClientError as ReturnType<typeof vi.fn>).mockClear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.useRealTimers());

const flush = () => act(async () => { await vi.advanceTimersByTimeAsync(500); });

describe('useRatingSaver', () => {
  it('серия кликов по одной потребности — один запрос с последним значением', async () => {
    save.mockResolvedValue({ allDone: false });
    const onSaved = vi.fn();
    const onSavedAt = vi.fn();
    const { result } = renderHook(() => useRatingSaver({ ...base, onSaved, onSavedAt }));
    act(() => { result.current('play', 3); result.current('play', 6); });
    expect(save).not.toHaveBeenCalled();
    await flush();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith('play', 6);
    expect(onSaved).toHaveBeenCalledWith('play', undefined);
    expect(onSavedAt).toHaveBeenCalledOnce();
  });

  it('стрик уходит наверх, когда оценены все потребности', async () => {
    const streak = { currentStreak: 3, totalDays: 5 };
    save.mockResolvedValue({ allDone: true, streak });
    const onSaved = vi.fn();
    const { result } = renderHook(() => useRatingSaver({ ...base, onSaved }));
    act(() => { result.current('play', 6); });
    await flush();
    expect(onSaved).toHaveBeenCalledWith('play', streak);
  });

  it('дата бэкафилла уходит в запрос', async () => {
    save.mockResolvedValue({ allDone: false });
    const { result } = renderHook(() => useRatingSaver({ ...base, date: '2026-10-14' }));
    act(() => { result.current('play', 4); });
    await flush();
    expect(save).toHaveBeenCalledWith('play', 4, '2026-10-14');
  });

  it('0 («не оценено») и офлайн не сохраняются', async () => {
    const { result, rerender } = renderHook((p: { off: boolean }) => useRatingSaver({ ...base, isOffline: p.off }), { initialProps: { off: false } });
    act(() => { result.current('play', 0); });
    await flush();
    rerender({ off: true });
    act(() => { result.current('play', 5); });
    await flush();
    expect(save).not.toHaveBeenCalled();
  });

  it('сбой сохранения уходит в reportClientError со своей секцией', async () => {
    save.mockRejectedValue(new Error('x'));
    const { result } = renderHook(() => useRatingSaver({ ...base, section: 'tracker' }));
    act(() => { result.current('play', 6); });
    await flush();
    expect(reportClientError).toHaveBeenCalledWith({ message: 'rating save failed', section: 'tracker' });
  });
});
