// @vitest-environment jsdom
// Лист «Задания» в кабинете мини-аппа: удаление задания в два тапа и отметка
// задания офлайн-клиента — паритет с вкладкой «Задания» сайта (QA 2026-10-26:
// задание нельзя было удалить, офлайн-клиенту закрыть его было некому).
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react';
import { useState } from 'react';
import { TasksSheet } from './TasksSheet';
import type { ClientDetail } from './types';

vi.mock('../../api', () => ({
  api: { deleteTherapyTask: vi.fn(), completeTask: vi.fn() },
}));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

type Task = ClientDetail['clientTasks'][number];
const task = (id: number, over: Partial<Task> = {}): Task => ({
  id,
  userId: 7,
  assignedBy: 2,
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

function Harness({ initial }: { initial: Task[] }) {
  const [clientTasks, setClientTasks] = useState(initial);
  const detail = {
    clientTasks,
    setClientTasks,
    setShowTasksSheet: vi.fn(),
    setShowAssign: vi.fn(),
  } as unknown as ClientDetail;
  return <TasksSheet detail={detail} />;
}

describe('TasksSheet — удаление задания', () => {
  it('первый тап спрашивает, второй удаляет', async () => {
    mockApi.deleteTherapyTask.mockResolvedValue({ ok: true });
    render(<Harness initial={[task(1), task(2)]} />);
    fireEvent.click(screen.getAllByLabelText('Удалить задание')[0]);
    expect(mockApi.deleteTherapyTask).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Точно удалить?'));
    await waitFor(() => expect(screen.queryByText('задание 1')).toBeNull());
    expect(mockApi.deleteTherapyTask).toHaveBeenCalledWith(1);
    expect(screen.getByText('задание 2')).toBeTruthy();
  });

  it('сбой удаления виден, задание на месте', async () => {
    mockApi.deleteTherapyTask.mockRejectedValue(new Error('403'));
    render(<Harness initial={[task(1)]} />);
    fireEvent.click(screen.getByLabelText('Удалить задание'));
    fireEvent.click(screen.getByText('Точно удалить?'));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('задание 1')).toBeTruthy();
  });
});

describe('TasksSheet — задание офлайн-клиента', () => {
  it('терапевт отмечает выполненным', async () => {
    mockApi.completeTask.mockResolvedValue({ ok: true });
    render(<Harness initial={[task(3, { userId: -5 })]} />);
    fireEvent.click(screen.getByText('Выполнено'));
    await waitFor(() =>
      expect(mockApi.completeTask).toHaveBeenCalledWith(3, true),
    );
    await waitFor(() =>
      expect(screen.getByLabelText('Выполнено')).toBeTruthy(),
    );
  });

  it('у клиента с аккаунтом кнопки «Выполнено» нет', () => {
    render(<Harness initial={[task(4)]} />);
    expect(screen.queryByText('Выполнено')).toBeNull();
  });
});
