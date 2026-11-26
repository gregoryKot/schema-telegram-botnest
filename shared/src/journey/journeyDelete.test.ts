// @vitest-environment jsdom
// useJourneyDelete: маршрутизация к нужному api-методу по типу записи,
// no-op для недоступных типов удаления, обработка успеха/неудачи (запись
// не пропадает при сбое сети — правило CLAUDE.md «читай → нашёл»).
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useJourneyDelete, type JourneyDeleteApi } from './journeyDelete';
import { ENTRY_DELETED_EVENT } from '../share/analytics';
import type { JourneyItem } from './journeyMeta';

function stubApi(overrides: Partial<JourneyDeleteApi> = {}): JourneyDeleteApi {
  return {
    deleteBeliefCheck: vi.fn().mockResolvedValue(undefined),
    deleteLetter: vi.fn().mockResolvedValue(undefined),
    deleteFlashcard: vi.fn().mockResolvedValue(undefined),
    trackEvent: vi.fn(),
    ...overrides,
  };
}

describe('useJourneyDelete', () => {
  it('belief_check уходит в deleteBeliefCheck с правильным id', async () => {
    const api = stubApi();
    const onDeleted = vi.fn();
    const { result } = renderHook(() => useJourneyDelete(api, onDeleted));
    const item: JourneyItem = { type: 'belief_check', at: '2026-07-20', id: 7 };
    act(() => result.current.remove(item));
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(api.deleteBeliefCheck).toHaveBeenCalledWith(7);
    expect(api.deleteLetter).not.toHaveBeenCalled();
    expect(api.deleteFlashcard).not.toHaveBeenCalled();
  });

  it('letter уходит в deleteLetter с правильным id', async () => {
    const api = stubApi();
    const onDeleted = vi.fn();
    const { result } = renderHook(() => useJourneyDelete(api, onDeleted));
    const item: JourneyItem = { type: 'letter', at: '2026-07-20', id: 11 };
    act(() => result.current.remove(item));
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(api.deleteLetter).toHaveBeenCalledWith(11);
  });

  it('flashcard уходит в deleteFlashcard с правильным id', async () => {
    const api = stubApi();
    const onDeleted = vi.fn();
    const { result } = renderHook(() => useJourneyDelete(api, onDeleted));
    const item: JourneyItem = { type: 'flashcard', at: '2026-07-20', id: 3 };
    act(() => result.current.remove(item));
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(api.deleteFlashcard).toHaveBeenCalledWith(3);
  });

  it('недоступный для удаления тип — no-op: ни один api-метод не зовётся', () => {
    const api = stubApi();
    const onDeleted = vi.fn();
    const { result } = renderHook(() => useJourneyDelete(api, onDeleted));
    const item: JourneyItem = { type: 'gratitude', at: '2026-07-20', id: 1 };
    act(() => result.current.remove(item));
    expect(api.deleteBeliefCheck).not.toHaveBeenCalled();
    expect(api.deleteLetter).not.toHaveBeenCalled();
    expect(api.deleteFlashcard).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('запись без id — no-op', () => {
    const api = stubApi();
    const onDeleted = vi.fn();
    const { result } = renderHook(() => useJourneyDelete(api, onDeleted));
    const item: JourneyItem = { type: 'belief_check', at: '2026-07-20' };
    act(() => result.current.remove(item));
    expect(api.deleteBeliefCheck).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('успех: трекает entry_deleted с { type }, затем зовёт onDeleted', async () => {
    const api = stubApi();
    const onDeleted = vi.fn();
    const { result } = renderHook(() => useJourneyDelete(api, onDeleted));
    const item: JourneyItem = { type: 'letter', at: '2026-07-20', id: 5 };
    act(() => result.current.remove(item));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
    expect(api.trackEvent).toHaveBeenCalledWith(ENTRY_DELETED_EVENT, {
      type: 'letter',
    });
  });

  it('падение trackEvent не превращает успешное удаление в неудачу', async () => {
    const api = stubApi({
      trackEvent: vi.fn(() => {
        throw new Error('analytics down');
      }),
    });
    const onDeleted = vi.fn();
    const { result } = renderHook(() => useJourneyDelete(api, onDeleted));
    const item: JourneyItem = { type: 'letter', at: '2026-07-20', id: 5 };
    act(() => result.current.remove(item));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
    expect(result.current.failed).toBe(false);
  });

  it('сбой API: failed=true, onDeleted НЕ вызывается — запись остаётся видимой', async () => {
    const api = stubApi({
      deleteLetter: vi.fn().mockRejectedValue(new Error('network')),
    });
    const onDeleted = vi.fn();
    const { result } = renderHook(() => useJourneyDelete(api, onDeleted));
    const item: JourneyItem = { type: 'letter', at: '2026-07-20', id: 5 };
    act(() => result.current.remove(item));
    await waitFor(() => expect(result.current.failed).toBe(true));
    expect(onDeleted).not.toHaveBeenCalled();
    expect(result.current.busy).toBe(false);
  });

  it('повторный вызов remove во время busy игнорируется (guard re-entry)', async () => {
    let resolveDelete: (() => void) | undefined;
    const api = stubApi({
      deleteLetter: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveDelete = resolve;
          }),
      ),
    });
    const onDeleted = vi.fn();
    const { result } = renderHook(() => useJourneyDelete(api, onDeleted));
    const item: JourneyItem = { type: 'letter', at: '2026-07-20', id: 5 };
    act(() => result.current.remove(item));
    expect(result.current.busy).toBe(true);
    act(() => result.current.remove(item));
    expect(api.deleteLetter).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveDelete?.();
      await Promise.resolve();
    });
    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
  });
});
