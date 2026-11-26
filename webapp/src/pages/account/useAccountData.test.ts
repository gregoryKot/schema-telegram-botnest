// @vitest-environment jsdom
// Загрузка «Аккаунта» (/api/auth/me): отказ — текст ошибки и ровно один отчёт наверх (№14),
// и при монтировании, и при повторной загрузке (refresh); успех — без отчёта.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { NO_CONNECTION_TEXT, SERVER_DOWN_TEXT } from '../../../../shared/src/api/humanizeError';

vi.mock('../../api', () => ({ reportClientError: vi.fn() }));
import { reportClientError } from '../../api';
import { useAccountData } from './useAccountData';

const fetchMock = vi.fn();
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const ME = { userId: '42', providers: [{ provider: 'vk', email: null, displayName: 'Аня' }] };

beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => vi.unstubAllGlobals());

describe('useAccountData — отчёт наверх', () => {
  it('сервер не ответил (500) — прежний текст ошибки и ровно один отчёт со статусом', async () => {
    fetchMock.mockResolvedValue(reply(500, {}));
    const { result } = renderHook(() => useAccountData('tok'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(SERVER_DOWN_TEXT);
    expect(reportClientError).toHaveBeenCalledTimes(1);
    expect(reportClientError).toHaveBeenCalledWith({ message: 'account load failed: HTTP 500', section: 'account' });
  });

  it('загрузка прошла — отчёта нет; повторная (refresh) упала — один отчёт', async () => {
    fetchMock.mockResolvedValueOnce(reply(200, ME)).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const { result } = renderHook(() => useAccountData('tok'));
    await waitFor(() => expect(result.current.providers).toHaveLength(1));
    expect(reportClientError).not.toHaveBeenCalled();
    await act(async () => { await result.current.refresh(); });
    expect(result.current.error).toBe(NO_CONNECTION_TEXT);
    expect(reportClientError).toHaveBeenCalledTimes(1);
    expect(reportClientError).toHaveBeenCalledWith({ message: 'account load failed: network', section: 'account' });
  });
});
