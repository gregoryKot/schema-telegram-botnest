// @vitest-environment jsdom
// Аудит 2026-11, U2: о новом задании терапевта узнать было неоткуда — счётчик
// на строке «Задания» и точка на «Ещё». «Новое» = от терапевта, не выполнено и
// назначено позже отметки, которую ставит открытие «Заданий».
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act, cleanup } from '@testing-library/react';
import type { UserTask } from '../../api';
import { TASKS_SEEN_KEY, countNewTasks, markTasksSeen, useNewTasksCount } from './newTasks';
import { notifyTasksChanged } from '../../../../shared/src/tasks/tasksChanged';

vi.mock('../../api', () => ({ api: { getTasks: vi.fn() }, reportClientError: vi.fn() }));
import { api, reportClientError } from '../../api';
const getTasks = api.getTasks as unknown as ReturnType<typeof vi.fn>;

const task = (o: Partial<UserTask>): UserTask => ({
  id: 1, userId: 1, assignedBy: 9, type: 'custom', text: 'x', targetDays: null, needId: null,
  dueDate: null, done: null, completedAt: null, createdAt: '2026-11-05T10:00:00.000Z', ...o,
});

beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });
afterEach(cleanup);

describe('countNewTasks', () => {
  const tasks = [
    task({ id: 1, createdAt: '2026-11-01T10:00:00.000Z' }),
    task({ id: 2, createdAt: '2026-11-06T10:00:00.000Z' }),
    task({ id: 3, createdAt: '2026-11-07T10:00:00.000Z', done: true }),
    task({ id: 4, createdAt: '2026-11-07T10:00:00.000Z', assignedBy: null }),
  ];

  it('без отметки — все невыполненные задания терапевта; свои цели и выполненные не считаются', () => {
    expect(countNewTasks(tasks, null)).toBe(2);
  });

  it('с отметкой — только назначенные позже неё', () => {
    expect(countNewTasks(tasks, '2026-11-05T00:00:00.000Z')).toBe(1);
    expect(countNewTasks(tasks, '2026-11-06T10:00:00.000Z')).toBe(0);
  });

  it('пустой список и битая отметка не ломают счёт', () => {
    expect(countNewTasks([], null)).toBe(0);
    expect(countNewTasks(tasks, 'мусор')).toBe(2);
  });
});

describe('markTasksSeen', () => {
  it('отметка — самое позднее назначение терапевта и только вперёд', () => {
    markTasksSeen([task({ createdAt: '2026-11-06T10:00:00.000Z' }), task({ assignedBy: null, createdAt: '2026-11-09T00:00:00.000Z' })]);
    expect(localStorage.getItem(TASKS_SEEN_KEY)).toBe('2026-11-06T10:00:00.000Z');
    markTasksSeen([task({ createdAt: '2026-11-01T10:00:00.000Z' })]);
    expect(localStorage.getItem(TASKS_SEEN_KEY)).toBe('2026-11-06T10:00:00.000Z');
  });

  it('заданий от терапевта нет — отметка не ставится', () => {
    markTasksSeen([task({ assignedBy: null })]);
    expect(localStorage.getItem(TASKS_SEEN_KEY)).toBeNull();
  });
});

describe('useNewTasksCount', () => {
  it('сохранил отметку (открыл «Задания») → счётчик в навигации гаснет сразу', async () => {
    const fresh = task({ id: 2, createdAt: '2026-11-06T10:00:00.000Z' });
    getTasks.mockResolvedValue([fresh]);
    const { result } = renderHook(() => useNewTasksCount());
    await waitFor(() => expect(result.current).toBe(1));
    act(() => markTasksSeen([fresh]));
    expect(result.current).toBe(0);
  });

  it('задания поменялись на сервере — список перечитывается', async () => {
    getTasks.mockResolvedValueOnce([]).mockResolvedValue([task({})]);
    const { result } = renderHook(() => useNewTasksCount());
    await waitFor(() => expect(getTasks).toHaveBeenCalledTimes(1));
    act(() => notifyTasksChanged());
    await waitFor(() => expect(result.current).toBe(1));
  });

  it('выключен (кабинет терапевта) — не грузит и показывает 0', () => {
    const { result } = renderHook(() => useNewTasksCount(false));
    expect(result.current).toBe(0);
    expect(getTasks).not.toHaveBeenCalled();
  });

  it('сбой загрузки — 0 и отчёт, а не падение', async () => {
    getTasks.mockRejectedValue(new Error('down'));
    const { result } = renderHook(() => useNewTasksCount());
    await waitFor(() => expect(reportClientError).toHaveBeenCalledTimes(1));
    expect(result.current).toBe(0);
  });
});
