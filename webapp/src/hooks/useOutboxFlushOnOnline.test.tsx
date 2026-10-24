// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const flushOutbox = vi.hoisted(() => vi.fn());
const reportClientError = vi.hoisted(() => vi.fn());
vi.mock('../api', () => ({ api: { flushOutbox }, reportClientError }));
import { useOutboxFlushOnOnline } from './useOutboxFlushOnOnline';

beforeEach(() => vi.clearAllMocks());

describe('useOutboxFlushOnOnline', () => {
  it('событие online запускает отправку очереди; без события — не запускает', () => {
    flushOutbox.mockResolvedValue(undefined);
    renderHook(() => useOutboxFlushOnOnline());
    expect(flushOutbox).not.toHaveBeenCalled();
    act(() => { window.dispatchEvent(new Event('online')); });
    expect(flushOutbox).toHaveBeenCalledTimes(1);
    act(() => { window.dispatchEvent(new Event('online')); });
    expect(flushOutbox).toHaveBeenCalledTimes(2);
  });

  it('отказ отправки уходит в телеметрию, а не роняет страницу', async () => {
    flushOutbox.mockRejectedValue(new Error('net'));
    renderHook(() => useOutboxFlushOnOnline());
    act(() => { window.dispatchEvent(new Event('online')); });
    await waitFor(() => expect(reportClientError).toHaveBeenCalledTimes(1));
  });

  it('после размонтирования слушатель снят', () => {
    flushOutbox.mockResolvedValue(undefined);
    const { unmount } = renderHook(() => useOutboxFlushOnOnline());
    unmount();
    window.dispatchEvent(new Event('online'));
    expect(flushOutbox).not.toHaveBeenCalled();
  });
});
