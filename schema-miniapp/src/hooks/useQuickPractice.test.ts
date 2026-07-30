// @vitest-environment jsdom
// Хук одной практики «Здесь и сейчас» (правило «одна механика — один хук»,
// три практики делят одну реализацию). Правило CLAUDE.md read-after-write:
// complete() обязан класть в count значение ИЗ ОТВЕТА сервера, а не +1
// локально — тестируем именно связку «записал → счётчик показывает то, что
// вернул бэк», а не только факт вызова POST.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useQuickPractice } from './useQuickPractice';

vi.mock('../api', () => ({
  api: { getPracticeSessions: vi.fn(), recordPracticeSession: vi.fn() },
}));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  vi.clearAllMocks();
});

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('useQuickPractice — загрузка счётчика', () => {
  it('на старте count — своё число из GET /api/practice-sessions', async () => {
    mockApi.getPracticeSessions.mockResolvedValue({
      breathing: 1,
      grounding: 2,
      stop: 5,
    });
    const { result } = renderHook(() => useQuickPractice('stop'));
    expect(result.current.count).toBeNull(); // до ответа — не выдуманный 0
    await flush();
    expect(result.current.count).toBe(5);
  });

  it('GET упал → count остаётся null, а не превращается в 0', async () => {
    mockApi.getPracticeSessions.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useQuickPractice('breathing'));
    await flush();
    expect(result.current.count).toBeNull();
  });
});

describe('useQuickPractice — complete()', () => {
  it('шлёт POST и кладёт в count значение ИЗ ОТВЕТА (read-after-write)', async () => {
    mockApi.getPracticeSessions.mockResolvedValue({
      breathing: 0,
      grounding: 0,
      stop: 2,
    });
    mockApi.recordPracticeSession.mockResolvedValue({ ok: true, count: 3 });
    const { result } = renderHook(() => useQuickPractice('stop'));
    await flush();

    await act(async () => {
      result.current.complete();
      await flush();
    });

    expect(mockApi.recordPracticeSession).toHaveBeenCalledWith('stop');
    expect(result.current.count).toBe(3); // из ответа, не 2+1 локально
    expect(result.current.completed).toBe(true);
  });

  it('повторный complete() в рамках одного открытия не шлёт второй POST', async () => {
    mockApi.getPracticeSessions.mockResolvedValue({
      breathing: 0,
      grounding: 0,
      stop: 0,
    });
    mockApi.recordPracticeSession.mockResolvedValue({ ok: true, count: 1 });
    const { result } = renderHook(() => useQuickPractice('stop'));
    await flush();

    await act(async () => {
      result.current.complete();
      result.current.complete();
      await flush();
    });

    expect(mockApi.recordPracticeSession).toHaveBeenCalledTimes(1);
  });

  it('POST упал — completed остаётся false, повтор из компонента возможен', async () => {
    mockApi.getPracticeSessions.mockResolvedValue({
      breathing: 0,
      grounding: 0,
      stop: 0,
    });
    mockApi.recordPracticeSession.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useQuickPractice('stop'));
    await flush();

    await act(async () => {
      result.current.complete();
      await flush();
    });

    expect(result.current.completed).toBe(false);
  });
});
