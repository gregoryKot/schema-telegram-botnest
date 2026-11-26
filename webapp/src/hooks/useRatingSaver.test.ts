// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../api', () => ({
  api: { saveRating: vi.fn() },
  reportClientError: vi.fn(),
}));
import { api, reportClientError } from '../api';
import { useRatingSaver } from './useRatingSaver';
import { todayStr } from '../../../shared/src/utils/format';

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
    expect(save).toHaveBeenCalledWith('play', 6, todayStr());
    expect(onSaved).toHaveBeenCalledWith('play', undefined);
    expect(onSavedAt).toHaveBeenCalledOnce();
  });

  // Автопереход трекера: «На главную» на экране «Готово» нажимают раньше 500 мс после
  // последнего ответа — закрытие экрана не должно терять оценку.
  it('закрытие экрана до конца debounce отправляет ждущую оценку, а не теряет её', async () => {
    save.mockResolvedValue({ allDone: false });
    const { result, unmount } = renderHook(() => useRatingSaver({ ...base }));
    act(() => { result.current('play', 8); });
    expect(save).not.toHaveBeenCalled();
    unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith('play', 8, todayStr());
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('уже отправленная оценка при закрытии не уходит второй раз', async () => {
    save.mockResolvedValue({ allDone: false });
    const { result, unmount } = renderHook(() => useRatingSaver({ ...base }));
    act(() => { result.current('play', 8); });
    await flush();
    unmount();
    expect(save).toHaveBeenCalledTimes(1);
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

  it('0 («не оценено») не сохраняется', async () => {
    const { result } = renderHook(() => useRatingSaver({ ...base }));
    act(() => { result.current('play', 0); });
    await flush();
    expect(save).not.toHaveBeenCalled();
  });

  // QA 2026-11-03, К3: тап в последние полсекунды дня уезжал в завтра —
  // дата бралась в момент отправки, после задержки.
  it('день оценки — день касания, даже если отправка случилась после полуночи', async () => {
    vi.setSystemTime(new Date(2026, 10, 3, 23, 59, 59, 800));
    save.mockResolvedValue({ allDone: false });
    const { result } = renderHook(() => useRatingSaver({ ...base }));
    act(() => { result.current('play', 7); });
    await flush();
    expect(todayStr()).toBe('2026-11-04');
    expect(save).toHaveBeenCalledWith('play', 7, '2026-11-03');
  });

  // QA B-З9: 5xx и обрыв сети кладут оценку в очередь и отвечают успехом — экрану нужен сигнал.
  it('оценка ушла в очередь — onQueued; принята сервером — нет', async () => {
    const onQueued = vi.fn();
    const { result } = renderHook(() => useRatingSaver({ ...base, onQueued }));
    save.mockResolvedValueOnce({ ok: true, allDone: false });
    act(() => { result.current('play', 6); });
    await flush();
    expect(onQueued).not.toHaveBeenCalled();
    save.mockResolvedValueOnce({ ok: true, allDone: false, queued: true });
    act(() => { result.current('limits', 4); });
    await flush();
    expect(onQueued).toHaveBeenCalledOnce();
  });

  it('сбой сохранения уходит в reportClientError со своей секцией', async () => {
    save.mockRejectedValue(new Error('x'));
    const { result } = renderHook(() => useRatingSaver({ ...base, section: 'tracker' }));
    act(() => { result.current('play', 6); });
    await flush();
    expect(reportClientError).toHaveBeenCalledWith({ message: 'rating save failed', section: 'tracker' });
  });

  // Аудит 2026-11, E4: сервер отказал насовсем — экран откатывает плитку к оценке до серии касаний.
  it('отказ — onRejected с оценкой до серии; без прежней оценки — undefined', async () => {
    save.mockRejectedValue(new Error('API error: 400'));
    const onRejected = vi.fn();
    const { result } = renderHook(() => useRatingSaver({ ...base, onRejected }));
    act(() => { result.current('play', 6, 4); result.current('play', 8, 6); });
    act(() => { result.current('limits', 2, undefined); result.current('limits', 6, 2); });
    await flush();
    expect(onRejected).toHaveBeenCalledWith('play', 4);
    expect(onRejected).toHaveBeenCalledWith('limits', undefined);
  });

  it('контроль: принято или ушло в очередь — onRejected не зовётся', async () => {
    const onRejected = vi.fn();
    const { result } = renderHook(() => useRatingSaver({ ...base, onRejected }));
    save.mockResolvedValueOnce({ ok: true, allDone: false, queued: true });
    act(() => { result.current('play', 6, 4); });
    await flush();
    save.mockResolvedValueOnce({ ok: true, allDone: false });
    act(() => { result.current('play', 8, 6); });
    await flush();
    expect(onRejected).not.toHaveBeenCalled();
  });
});
