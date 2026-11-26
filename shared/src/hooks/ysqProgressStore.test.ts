// @vitest-environment jsdom
// Хранилище YSQ на устройстве: единственный писатель ключей ysq_progress и ysq_result.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  writeYsqProgress,
  clearYsqProgress,
  writeYsqResult,
  clearYsqResult,
  YSQ_PROGRESS_EVENT,
} from './ysqProgressStore';
import { YSQ_PROGRESS_KEY, YSQ_RESULT_KEY } from './ysqStorageKeys';

beforeEach(() => localStorage.clear());

describe('ysqProgressStore', () => {
  it('writeYsqResult кладёт дату и ответы', () => {
    writeYsqResult('2026-11-05T10:00:00.000Z', [1, 2, 3]);
    expect(JSON.parse(localStorage.getItem(YSQ_RESULT_KEY)!)).toEqual({
      date: '2026-11-05T10:00:00.000Z',
      answers: [1, 2, 3],
    });
  });

  it('clearYsqResult убирает ключ', () => {
    writeYsqResult('2026-11-05', [1]);
    clearYsqResult();
    expect(localStorage.getItem(YSQ_RESULT_KEY)).toBeNull();
  });

  it('writeYsqProgress кладёт ключ и шлёт событие с числом ответов', () => {
    const listener = vi.fn();
    window.addEventListener(YSQ_PROGRESS_EVENT, listener);
    writeYsqProgress([1, 0, 3], 2);
    window.removeEventListener(YSQ_PROGRESS_EVENT, listener);
    expect(localStorage.getItem(YSQ_PROGRESS_KEY)).not.toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toBe(2);
  });

  it('clearYsqProgress убирает ключ и шлёт «прогресса нет»', () => {
    writeYsqProgress([1], 0);
    const listener = vi.fn();
    window.addEventListener(YSQ_PROGRESS_EVENT, listener);
    clearYsqProgress();
    window.removeEventListener(YSQ_PROGRESS_EVENT, listener);
    expect(localStorage.getItem(YSQ_PROGRESS_KEY)).toBeNull();
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toBeNull();
  });
});
