// @vitest-environment jsdom
// QA 2026-11, К1: у входа в тест на схемы — пометка, что терапевт просит его
// пройти. Пометка из реальных заданий и гаснет, когда задание закрыто.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup, act } from '@testing-library/react';
import {
  hasOpenYsqRequest,
  useYsqRequested,
  ysqEntrySub,
  YSQ_TASK_TYPE,
} from './ysqRequestMark';
import { notifyTasksChanged } from './tasksChanged';
import type { UserTask } from '../apiTypes';

afterEach(cleanup);

const task = (over: Partial<UserTask>): UserTask => ({
  id: 1,
  userId: 1,
  assignedBy: 9,
  type: YSQ_TASK_TYPE,
  text: 'Пройти тест на схемы',
  targetDays: null,
  needId: null,
  dueDate: null,
  done: null,
  completedAt: null,
  createdAt: '2026-11-01T00:00:00Z',
  ...over,
});

describe('hasOpenYsqRequest', () => {
  it('открытое задание «пройти тест» от терапевта — запрос есть', () => {
    expect(hasOpenYsqRequest([task({})])).toBe(true);
  });

  it('выполненное, своё и задание другого типа — запроса нет', () => {
    expect(hasOpenYsqRequest([task({ done: true })])).toBe(false);
    expect(hasOpenYsqRequest([task({ assignedBy: null })])).toBe(false);
    expect(hasOpenYsqRequest([task({ type: 'custom' })])).toBe(false);
    expect(hasOpenYsqRequest([])).toBe(false);
  });
});

describe('ysqEntrySub', () => {
  it('запрос терапевта — первым делом, с результатом и без', () => {
    expect(ysqEntrySub({ hasResult: false, requested: true })).toMatch(
      /^Терапевт просит пройти/,
    );
    expect(ysqEntrySub({ hasResult: true, requested: true })).toBe(
      'Терапевт просит пройти заново',
    );
  });

  it('без запроса — прежние подписи', () => {
    expect(ysqEntrySub({ hasResult: true, requested: false })).toBe(
      'Посмотреть или пройти заново',
    );
    expect(ysqEntrySub({ hasResult: false, requested: false })).toBe(
      '116 вопросов · ~10 минут',
    );
  });
});

describe('useYsqRequested', () => {
  it('пометка есть, пока задание открыто; закрыто — сигнал снимает её', async () => {
    const getTasks = vi.fn().mockResolvedValue([task({})]);
    const { result } = renderHook(() => useYsqRequested(getTasks));
    await waitFor(() => expect(result.current).toBe(true));
    getTasks.mockResolvedValue([]);
    act(() => notifyTasksChanged());
    await waitFor(() => expect(result.current).toBe(false));
  });

  it('сбой загрузки — пометки нет', async () => {
    const getTasks = vi.fn().mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useYsqRequested(getTasks));
    await waitFor(() => expect(getTasks).toHaveBeenCalled());
    expect(result.current).toBe(false);
  });
});
