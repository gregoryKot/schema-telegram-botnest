// @vitest-environment jsdom
// Сводки заданий кабинета: один запрос на все карточки; invalidate() перечитывает,
// поздний ответ прежнего запроса свежий не перезаписывает; отказ — отчёт наверх (№14), сводки нет.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useClientTaskDigests } from './useClientTaskDigests';
import type { TherapyClientSummary, UserTask } from '../../api';

vi.mock('../../api', () => ({ api: { getAllTherapyTasks: vi.fn() }, reportClientError: vi.fn() }));
import { reportClientError } from '../../api';

beforeEach(() => vi.clearAllMocks());

const client = { telegramId: 7, nextSession: null, meetingDays: [] } as unknown as TherapyClientSummary;
const open = (id: number): UserTask => ({
  id, userId: 7, assignedBy: 9, type: 'note', text: 't', targetDays: null, needId: null, dueDate: null,
  done: null, completedAt: null, createdAt: '2026-07-01',
});
const group = (n: number) => [{ clientId: 7, tasks: Array.from({ length: n }, (_, i) => open(i + 1)) }];

describe('useClientTaskDigests', () => {
  it('грузит при монтировании и отдаёт сводку клиента; без заданий — null', async () => {
    const fetchAll = vi.fn().mockResolvedValue(group(2));
    const { result } = renderHook(() => useClientTaskDigests(fetchAll));
    expect(result.current.digestOf(client)).toBeNull(); // ещё не загрузилось
    await act(async () => {});
    expect(result.current.digestOf(client)).toEqual({ done: 0, waiting: 2, sinceSession: false });
    expect(result.current.digestOf({ ...client, telegramId: 8 })).toBeNull();
    expect(fetchAll).toHaveBeenCalledTimes(1);
  });

  it('invalidate() перечитывает; опоздавший старый ответ не затирает свежий', async () => {
    let resolveOld!: (v: ReturnType<typeof group>) => void;
    const fetchAll = vi.fn()
      .mockReturnValueOnce(new Promise<ReturnType<typeof group>>(r => { resolveOld = r; }))
      .mockResolvedValueOnce(group(3));
    const { result } = renderHook(() => useClientTaskDigests(fetchAll));
    await act(async () => { result.current.invalidate(); });
    await act(async () => { resolveOld(group(1)); });
    expect(result.current.digestOf(client)?.waiting).toBe(3);
  });

  it('отказ запроса — сводки нет и отчёт наверх', async () => {
    const fetchAll = vi.fn().mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useClientTaskDigests(fetchAll));
    await act(async () => {});
    expect(result.current.digestOf(client)).toBeNull();
    expect(reportClientError).toHaveBeenCalledWith(expect.objectContaining({ section: 'therapist.tasks' }));
  });
});
