// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCallback } from 'react';
import { useAsyncData } from './useAsyncData';

describe('useAsyncData', () => {
  it('returns the initial value before the fetch resolves', () => {
    const fetcher = () => new Promise<number[]>(() => { /* never resolves */ });
    const { result } = renderHook(() => useAsyncData<number[]>(fetcher, []));
    expect(result.current.data).toEqual([]);
  });

  it('loads data on mount', async () => {
    const fetcher = vi.fn().mockResolvedValue([1, 2, 3]);
    const { result } = renderHook(() => useAsyncData<number[]>(fetcher, []));
    await waitFor(() => expect(result.current.data).toEqual([1, 2, 3]));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('reload() refetches and updates data', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce([1])
      .mockResolvedValueOnce([1, 2]);
    const { result } = renderHook(() => useAsyncData<number[]>(fetcher, []));
    await waitFor(() => expect(result.current.data).toEqual([1]));
    await act(async () => { await result.current.reload(); });
    expect(result.current.data).toEqual([1, 2]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('refetches when the fetcher identity changes', async () => {
    const load = vi.fn((k: string) => Promise.resolve([k]));
    const { result, rerender } = renderHook(
      ({ key }: { key: string }) => {
        const fetcher = useCallback(() => load(key), [key]);
        return useAsyncData<string[]>(fetcher, []);
      },
      { initialProps: { key: 'a' } },
    );
    await waitFor(() => expect(result.current.data).toEqual(['a']));
    rerender({ key: 'b' });
    await waitFor(() => expect(result.current.data).toEqual(['b']));
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('does not set state from a fetch that resolves after unmount', async () => {
    let resolve!: (v: number[]) => void;
    const fetcher = () => new Promise<number[]>((r) => { resolve = r; });
    const { result, unmount } = renderHook(() => useAsyncData<number[]>(fetcher, []));
    unmount();
    // Resolving after unmount must not throw or warn — the alive guard drops it.
    await act(async () => { resolve([9]); await Promise.resolve(); });
    expect(result.current.data).toEqual([]);
  });

  it('keeps previous data when the fetcher rejects (no throw)', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce([1])
      .mockRejectedValueOnce(new Error('network'));
    const { result } = renderHook(() => useAsyncData<number[]>(fetcher, []));
    await waitFor(() => expect(result.current.data).toEqual([1]));
    await act(async () => { await result.current.reload(); });
    expect(result.current.data).toEqual([1]);
  });
});
