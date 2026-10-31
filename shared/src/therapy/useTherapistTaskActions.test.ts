// @vitest-environment jsdom
// Удаление задания терапевтом и отметка у офлайн-клиента — общая механика
// сайта и мини-аппа (QA 2026-10-26).
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useState } from 'react';
import {
  therapistClosesTask,
  useTherapistTaskActions,
  type TherapistTaskApi,
} from './useTherapistTaskActions';
import type { UserTask } from '../apiTypes';

const task = (id: number, over: Partial<UserTask> = {}): UserTask => ({
  id,
  userId: 7,
  assignedBy: 1,
  type: 'custom',
  text: `задание ${id}`,
  targetDays: null,
  needId: null,
  dueDate: null,
  done: null,
  completedAt: null,
  createdAt: '2026-10-01T12:00:00Z',
  ...over,
});

function setup(api: TherapistTaskApi, initial: UserTask[]) {
  return renderHook(() => {
    const [tasks, setTasks] = useState(initial);
    return { tasks, ...useTherapistTaskActions(api, setTasks) };
  });
}

describe('useTherapistTaskActions', () => {
  it('удалил → задание пропало из списка', async () => {
    const api = {
      deleteTherapyTask: vi.fn().mockResolvedValue({ ok: true }),
      completeTask: vi.fn(),
    };
    const { result } = setup(api, [task(1), task(2)]);
    await act(async () => {
      await expect(result.current.remove(1)).resolves.toBe(true);
    });
    expect(api.deleteTherapyTask).toHaveBeenCalledWith(1);
    expect(result.current.tasks.map((t) => t.id)).toEqual([2]);
    expect(result.current.error).toBe('');
  });

  it('сбой удаления — задание на месте, ошибка видна', async () => {
    const api = {
      deleteTherapyTask: vi.fn().mockRejectedValue(new Error('403')),
      completeTask: vi.fn(),
    };
    const { result } = setup(api, [task(1)]);
    await act(async () => {
      await expect(result.current.remove(1)).resolves.toBe(false);
    });
    expect(result.current.tasks).toHaveLength(1);
    expect(result.current.error).toBe('Не удалось удалить задание');
  });

  it('отметка офлайн-задания — выполнено в списке', async () => {
    const api = {
      deleteTherapyTask: vi.fn(),
      completeTask: vi.fn().mockResolvedValue({ ok: true }),
    };
    const { result } = setup(api, [task(3, { userId: -5 })]);
    await act(async () => {
      await result.current.markDone(3);
    });
    expect(api.completeTask).toHaveBeenCalledWith(3, true);
    expect(result.current.tasks[0].done).toBe(true);
    expect(result.current.tasks[0].completedAt).toBeTruthy();
  });
});

describe('therapistClosesTask', () => {
  it('только открытое задание офлайн-клиента', () => {
    expect(therapistClosesTask({ userId: -5, done: null })).toBe(true);
    expect(therapistClosesTask({ userId: '-5', done: null })).toBe(true);
    expect(therapistClosesTask({ userId: 7, done: null })).toBe(false);
    expect(therapistClosesTask({ userId: -5, done: true })).toBe(false);
  });
});
