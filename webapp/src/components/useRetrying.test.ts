// @vitest-environment jsdom
// Повтор, который видно (RequireAuth «Сервер не отвечает»): занят, пока обещание не решилось, второй тап не
// плодит попыток; отказ run не уходит необработанным — отчёт наверх, кнопка снова свободна (ревью g1).
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useRetrying } from './useRetrying';

const report = vi.hoisted(() => vi.fn());
vi.mock('../api', () => ({ reportClientError: report }));

describe('useRetrying', () => {
  it('занят, пока обещание не решилось; повтор во время занятости не запускает второй', async () => {
    let done!: () => void;
    const run = vi.fn(() => new Promise<boolean>(r => { done = () => r(true); }));
    const { result } = renderHook(() => useRetrying(run));
    expect(result.current[0]).toBe(false);
    act(() => result.current[1]());
    expect(result.current[0]).toBe(true);
    act(() => result.current[1]());
    expect(run).toHaveBeenCalledTimes(1);
    await act(async () => { done(); });
    expect(result.current[0]).toBe(false);
    expect(report).not.toHaveBeenCalled();
  });

  it('run отклонился: retrying снова false, отказ — в отчёт, необработанного отказа нет', async () => {
    const run = vi.fn(() => Promise.reject(new Error('сеть упала')));
    const { result } = renderHook(() => useRetrying(run));
    await act(async () => { result.current[1](); });
    expect(result.current[0]).toBe(false);
    expect(report).toHaveBeenCalledWith({ message: 'retry failed: сеть упала', section: 'useRetrying' });
  });
});
