// @vitest-environment jsdom
// Вкладка «Задания» у терапевта: удаление задания с подтверждением и
// отметка задания офлайн-клиента (QA 2026-10-26: удалить задание было
// нельзя, а офлайн-клиенту задание закрыть было некому).
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { ClientTasksTab } from './ClientTasksTab';
import type { ClientDetail } from './clientSheetTypes';
import type { UserTask } from '../../api';

vi.mock('../../api', () => ({
  api: { deleteTherapyTask: vi.fn(), completeTask: vi.fn() },
}));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

const task = (id: number, over: Partial<UserTask> = {}): UserTask => ({
  id, userId: 7, assignedBy: 2, type: 'custom', text: `задание ${id}`, targetDays: null, needId: null,
  dueDate: null, done: null, completedAt: null, createdAt: '2026-10-01T12:00:00Z', ...over,
});

function Harness({ initial, clientId }: { initial: UserTask[]; clientId: number }) {
  const [clientTasks, setClientTasks] = useState(initial);
  const detail = { clientTasks, setClientTasks, selectedClient: { telegramId: clientId } } as unknown as ClientDetail;
  return <ClientTasksTab detail={detail} onAssign={vi.fn()} />;
}

describe('ClientTasksTab — удаление задания', () => {
  it('✕ спрашивает подтверждение; «Удалить» убирает задание', async () => {
    mockApi.deleteTherapyTask.mockResolvedValue({ ok: true });
    render(<Harness initial={[task(1), task(2)]} clientId={7} />);
    fireEvent.click(screen.getAllByLabelText('Удалить задание')[0]);
    expect(mockApi.deleteTherapyTask).not.toHaveBeenCalled();
    expect(screen.getByText(/пропадёт у клиента и из карточки/)).toBeTruthy();
    fireEvent.click(screen.getByText('Удалить'));
    await waitFor(() => expect(screen.queryByText('задание 1')).toBeNull());
    expect(mockApi.deleteTherapyTask).toHaveBeenCalledWith(1);
    expect(screen.getByText('задание 2')).toBeTruthy();
    expect(screen.queryByText('Удалить задание?')).toBeNull();
  });

  it('«Отмена» ничего не удаляет', () => {
    render(<Harness initial={[task(1)]} clientId={7} />);
    fireEvent.click(screen.getByLabelText('Удалить задание'));
    fireEvent.click(screen.getByText('Отмена'));
    expect(mockApi.deleteTherapyTask).not.toHaveBeenCalled();
    expect(screen.getByText('задание 1')).toBeTruthy();
  });

  it('сбой удаления виден в диалоге, задание на месте', async () => {
    mockApi.deleteTherapyTask.mockRejectedValue(new Error('403'));
    render(<Harness initial={[task(1)]} clientId={7} />);
    fireEvent.click(screen.getByLabelText('Удалить задание'));
    fireEvent.click(screen.getByText('Удалить'));
    expect(await screen.findByText('Не удалось удалить задание')).toBeTruthy();
    expect(screen.getByText('задание 1')).toBeTruthy();
  });
});

describe('ClientTasksTab — задание офлайн-клиента', () => {
  it('терапевт отмечает выполненным сам', async () => {
    mockApi.completeTask.mockResolvedValue({ ok: true });
    render(<Harness initial={[task(3, { userId: -5 })]} clientId={-5} />);
    fireEvent.click(screen.getByText('Выполнено'));
    await waitFor(() => expect(mockApi.completeTask).toHaveBeenCalledWith(3, true));
    await waitFor(() => expect(screen.getAllByText('Выполнено').some(n => n.className.includes('ds-badge'))).toBe(true));
  });

  it('клиенту с аккаунтом кнопки «Выполнено» нет — закрывает он сам', () => {
    render(<Harness initial={[task(4)]} clientId={7} />);
    expect(screen.queryByRole('button', { name: 'Выполнено' })).toBeNull();
  });
});
