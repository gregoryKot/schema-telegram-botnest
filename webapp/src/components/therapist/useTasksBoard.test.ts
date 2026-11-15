// @vitest-environment jsdom
// Доска «Задания» кабинета (QA 2026-11): лист кабинета не перемонтируется, и
// доска, загруженная один раз, жила старой после назначения задания в карточке.
// invalidate() перечитывает доску, которую уже открывали; поздний ответ
// прежнего запроса новую доску не перезаписывает. Отказ — отчёт наверх (№14).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTasksBoard, type BoardTasks } from './useTasksBoard';

vi.mock('../../api', () => ({ api: { getAllTherapyTasks: vi.fn() }, reportClientError: vi.fn() }));
import { reportClientError } from '../../api';

beforeEach(() => vi.clearAllMocks());

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
    expect(reportClientError).not.toHaveBeenCalled();
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

  it('сбой — failed, а не пустая доска, и ровно один отчёт; load() повторяет и снимает ошибку', async () => {
    const fetchAll = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(board('после повтора'));
    const { result } = renderHook(() => useTasksBoard(fetchAll));
    await act(async () => { result.current.open(); });
    expect(result.current.failed).toBe(true);
    expect(result.current.tasks).toBeNull();
    expect(reportClientError).toHaveBeenCalledWith({ message: 'tasks board load failed: network', section: 'therapist.tasks' });
    await act(async () => { result.current.load(); });
    expect(result.current.failed).toBe(false);
    expect(result.current.tasks).toEqual(board('после повтора'));
    expect(reportClientError).toHaveBeenCalledTimes(1);
  });

  it('отказ устаревшего запроса отчёт не шлёт: два упавших подряд — один отчёт', async () => {
    const fetchAll = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const { result } = renderHook(() => useTasksBoard(fetchAll));
    await act(async () => { result.current.open(); result.current.invalidate(); });
    expect(fetchAll).toHaveBeenCalledTimes(2);
    expect(result.current.failed).toBe(true);
    expect(reportClientError).toHaveBeenCalledTimes(1);
  });
});
