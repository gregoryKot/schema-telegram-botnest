// @vitest-environment jsdom
// Доска «Задания» кабинета (QA 2026-11): лист кабинета не перемонтируется, и
// доска, загруженная один раз, жила старой после назначения задания в карточке.
// invalidate() перечитывает доску, которую уже открывали; поздний ответ
// прежнего запроса новую доску не перезаписывает.
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTasksBoard, type BoardTasks } from './useTasksBoard';

vi.mock('../../api', () => ({ api: { getAllTherapyTasks: vi.fn() } }));

const board = (text: string): BoardTasks => [{
  clientId: 1, clientName: 'Анна',
  tasks: [{ id: 1, userId: 1, assignedBy: 9, type: 'note', text, targetDays: null, needId: null, dueDate: null, done: null, completedAt: null, createdAt: '2026-07-01' }],
}];

function deferred() {
  let resolve!: (v: BoardTasks) => void;
  const promise = new Promise<BoardTasks>(r => { resolve = r; });
  return { promise, resolve };
}

describe('useTasksBoard', () => {
  it('open() грузит доску один раз; повторный клик по вкладке запрос не шлёт', async () => {
    const fetchAll = vi.fn().mockResolvedValue(board('первое'));
    const { result } = renderHook(() => useTasksBoard(fetchAll));
    await act(async () => { result.current.open(); });
    expect(result.current.tasks).toEqual(board('первое'));
    await act(async () => { result.current.open(); });
    expect(fetchAll).toHaveBeenCalledTimes(1);
  });

  it('invalidate() до первого открытия ничего не грузит — доску и так прочтут при открытии', async () => {
    const fetchAll = vi.fn().mockResolvedValue(board('x'));
    const { result } = renderHook(() => useTasksBoard(fetchAll));
    await act(async () => { result.current.invalidate(); });
    expect(fetchAll).not.toHaveBeenCalled();
    expect(result.current.tasks).toBeNull();
  });

  it('назначили задание в карточке → открытая раньше доска перечитана и показывает новое', async () => {
    const fetchAll = vi.fn()
      .mockResolvedValueOnce(board('старое'))
      .mockResolvedValueOnce(board('назначенное в карточке'));
    const { result } = renderHook(() => useTasksBoard(fetchAll));
    await act(async () => { result.current.open(); });
    await act(async () => { result.current.invalidate(); });
    expect(fetchAll).toHaveBeenCalledTimes(2);
    expect(result.current.tasks).toEqual(board('назначенное в карточке'));
  });

  it('ответ, ушедший до изменения, доску не перезаписывает', async () => {
    const first = deferred();
    const second = deferred();
    const fetchAll = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => useTasksBoard(fetchAll));
    act(() => { result.current.open(); });
    act(() => { result.current.invalidate(); });
    await act(async () => { second.resolve(board('свежее')); });
    await act(async () => { first.resolve(board('до изменения')); });
    expect(result.current.tasks).toEqual(board('свежее'));
    expect(result.current.loading).toBe(false);
  });

  it('сбой — failed, а не пустая доска; load() повторяет и снимает ошибку', async () => {
    const fetchAll = vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(board('после повтора'));
    const { result } = renderHook(() => useTasksBoard(fetchAll));
    await act(async () => { result.current.open(); });
    expect(result.current.failed).toBe(true);
    expect(result.current.tasks).toBeNull();
    await act(async () => { result.current.load(); });
    expect(result.current.failed).toBe(false);
    expect(result.current.tasks).toEqual(board('после повтора'));
  });
});
