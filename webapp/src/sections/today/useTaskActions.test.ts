// @vitest-environment jsdom
// Регрессия check-silent-catch: completeTask/afterCreate раньше глотали
// сбой сети молча (.catch(() => {})) — юзер заканчивал упражнение или ставил
// цель, экран закрывался как будто всё сохранилось, а на сервере ничего не
// менялось. Тест бьёт по хуку (не по UI), чтобы у обоих потребителей —
// TodaySection.handleTaskComplete и AllTasksOverlay.onTaskDone — была общая
// гарантия «упало → видимая ошибка», а не «упало → тишина».
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useTaskActions } from './useTaskActions';

vi.mock('../../api', () => ({
  api: {
    getTasks: vi.fn(),
    getTaskHistory: vi.fn(),
    completeTask: vi.fn(),
  },
  reportClientError: vi.fn(),
}));
import { api, reportClientError } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;
const mockReport = reportClientError as unknown as ReturnType<typeof vi.fn>;

function task(overrides: Partial<{ id: number; done: boolean | null }> = {}) {
  return {
    id: 1, userId: 1, assignedBy: null, type: 'custom', text: 'Задание',
    targetDays: null, needId: null, dueDate: null, done: null,
    completedAt: null, createdAt: '2026-08-01T00:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getTasks.mockResolvedValue([]);
  mockApi.getTaskHistory.mockResolvedValue([]);
});

describe('useTaskActions — начальная загрузка', () => {
  it('падение фоновой загрузки не выставляет taskError, но и не исчезает бесследно — уходит в reportClientError', async () => {
    mockApi.getTasks.mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() => useTaskActions(0));
    await waitFor(() => expect(mockApi.getTasks).toHaveBeenCalled());
    await waitFor(() => expect(mockReport).toHaveBeenCalledTimes(1));
    expect(result.current.taskError).toBe(false);
    expect(result.current.tasks).toEqual([]);
  });
});

describe('useTaskActions — completeTask', () => {
  it('успех: список обновляется, ошибки нет', async () => {
    mockApi.completeTask.mockResolvedValue(undefined);
    mockApi.getTasks.mockResolvedValue([task({ done: true })]);
    const { result } = renderHook(() => useTaskActions(0));
    await waitFor(() => expect(mockApi.getTasks).toHaveBeenCalledTimes(1));

    const onDone = vi.fn();
    await act(async () => { await result.current.completeTask(1, onDone); });

    expect(result.current.taskError).toBe(false);
    expect(result.current.tasks).toEqual([task({ done: true })]);
    expect(onDone).toHaveBeenCalled();
  });

  it('сбой сети — видимая ошибка вместо тихого "как будто сохранилось", onDone не вызван', async () => {
    mockApi.completeTask.mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() => useTaskActions(0));
    await waitFor(() => expect(mockApi.getTasks).toHaveBeenCalledTimes(1));

    const onDone = vi.fn();
    await act(async () => { await result.current.completeTask(1, onDone); });

    expect(result.current.taskError).toBe(true);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('повторный вызов после успеха сбрасывает предыдущую ошибку', async () => {
    mockApi.completeTask.mockRejectedValueOnce(new Error('network down')).mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useTaskActions(0));
    await waitFor(() => expect(mockApi.getTasks).toHaveBeenCalledTimes(1));

    await act(async () => { await result.current.completeTask(1); });
    expect(result.current.taskError).toBe(true);

    await act(async () => { await result.current.completeTask(1); });
    expect(result.current.taskError).toBe(false);
  });
});

describe('useTaskActions — afterCreate (read-after-write после создания задания)', () => {
  it('рефетч после создания падает — список не обновился, но ошибка видима', async () => {
    const { result } = renderHook(() => useTaskActions(0));
    await waitFor(() => expect(mockApi.getTasks).toHaveBeenCalledTimes(1));

    mockApi.getTasks.mockRejectedValueOnce(new Error('network down'));
    const onDone = vi.fn();
    await act(async () => { await result.current.afterCreate(onDone); });

    expect(result.current.taskError).toBe(true);
    expect(onDone).not.toHaveBeenCalled();
  });
});
