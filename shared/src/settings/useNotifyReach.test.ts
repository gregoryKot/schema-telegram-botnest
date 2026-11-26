// @vitest-environment jsdom
// U5 (аудит 2026-11): «напомним» звучало и тем, кому напоминание не дойдёт.
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useNotifyReach } from './useNotifyReach';

describe('useNotifyReach', () => {
  it('до ответа — null, затем признак сервера', async () => {
    const getSettings = vi.fn().mockResolvedValue({ notifyReachable: false });
    const { result } = renderHook(() => useNotifyReach(getSettings));
    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current).toBe(false));
  });

  it('ответ без признака (старый сервер) — true', async () => {
    const getSettings = vi.fn().mockResolvedValue({});
    const { result } = renderHook(() => useNotifyReach(getSettings));
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('сбой запроса — null и лог, без падения', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const getSettings = vi.fn().mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useNotifyReach(getSettings));
    await waitFor(() =>
      expect(errSpy).toHaveBeenCalledWith(
        'getSettings failed',
        expect.any(Error),
      ),
    );
    expect(result.current).toBeNull();
    errSpy.mockRestore();
  });
});
