// @vitest-environment jsdom
// Ссылка запуска `tasks`/`tasks_<id>` (аудит 2026-11, U2) открывает «Задания»
// в «Ещё»: «Ещё» монтируется тем же тактом, что запрос, или уже на экране.
import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import type { UserTask } from '../../api';
import { requestTasksOpen, taskToOpen, useTasksSheet } from './tasksLaunch';

afterEach(cleanup);

const task = (id: number, type: string, text = ''): UserTask => ({
  id, userId: 1, assignedBy: 9, type, text, targetDays: null, needId: null,
  dueDate: null, done: null, completedAt: null, createdAt: '2026-11-05T10:00:00.000Z',
});

describe('useTasksSheet', () => {
  it('запрос до монтирования «Ещё» открывает лист с заданием, и только один раз', () => {
    requestTasksOpen(7);
    const a = renderHook(() => useTasksSheet());
    expect(a.result.current).toMatchObject({ open: true, taskId: 7 });
    a.unmount();
    const b = renderHook(() => useTasksSheet());
    expect(b.result.current.open).toBe(false);
  });

  it('запрос, когда «Ещё» уже на экране, тоже открывает; hide закрывает, show — список без задания', () => {
    const { result } = renderHook(() => useTasksSheet());
    expect(result.current.open).toBe(false);
    act(() => requestTasksOpen());
    expect(result.current).toMatchObject({ open: true, taskId: undefined });
    act(() => result.current.hide());
    expect(result.current.open).toBe(false);
    act(() => result.current.show());
    expect(result.current).toMatchObject({ open: true, taskId: undefined });
  });
});

describe('taskToOpen', () => {
  const tasks = [task(1, 'letter_to_self'), task(2, 'custom', 'Позвонить'), task(3, 'diary_streak'), task(4, 'ysq_test')];

  it('упражнение и тест по запросу терапевта открываются листом сразу', () => {
    expect(taskToOpen(tasks, 1)?.id).toBe(1);
    expect(taskToOpen(tasks, 4)?.id).toBe(4);
  });

  it('«Своё задание», дневник и неизвестный id — список (null)', () => {
    expect(taskToOpen(tasks, 2)).toBeNull();
    expect(taskToOpen(tasks, 3)).toBeNull();
    expect(taskToOpen(tasks, 99)).toBeNull();
  });
});
