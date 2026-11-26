// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { notifyTasksChanged, useTasksChanged } from './tasksChanged';

afterEach(cleanup);

describe('tasksChanged — сигнал «перечитай задания»', () => {
  it('подписанный экран узнаёт о событии, отписанный — нет', () => {
    const onChange = vi.fn();
    const { unmount } = renderHook(() => useTasksChanged(onChange));
    notifyTasksChanged();
    expect(onChange).toHaveBeenCalledTimes(1);
    unmount();
    notifyTasksChanged();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('зовётся свежий колбэк, а не тот, что был при подписке', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ cb }) => useTasksChanged(cb), {
      initialProps: { cb: first },
    });
    rerender({ cb: second });
    notifyTasksChanged();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
