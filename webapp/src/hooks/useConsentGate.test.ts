// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../api', () => ({
  api: { getDisclaimer: vi.fn(), acceptDisclaimer: vi.fn() },
  reportClientError: vi.fn(),
}));
import { api, reportClientError } from '../api';
import { markLoginConsentShown } from '../auth/loginConsent';
import { useConsentGate } from './useConsentGate';

const m = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  m.acceptDisclaimer.mockResolvedValue(undefined);
});

describe('useConsentGate', () => {
  it('accepted: true: экрана нет, согласие не пишется', async () => {
    m.getDisclaimer.mockResolvedValue({ accepted: true });
    const { result } = renderHook(() => useConsentGate());
    await waitFor(() => expect(result.current.state).toBe('done'));
    expect(m.acceptDisclaimer).not.toHaveBeenCalled();
  });

  it('accepted: false: нужен экран, acceptDisclaimer не зван до accept()', async () => {
    m.getDisclaimer.mockResolvedValue({ accepted: false });
    const { result } = renderHook(() => useConsentGate());
    await waitFor(() => expect(result.current.state).toBe('needed'));
    expect(m.acceptDisclaimer).not.toHaveBeenCalled();
    await act(async () => { await result.current.accept(); });
    expect(m.acceptDisclaimer).toHaveBeenCalledTimes(1);
    expect(result.current.state).toBe('done');
  });

  it('сбой accept(): остаёмся на экране с признаком ошибки', async () => {
    m.getDisclaimer.mockResolvedValue({ accepted: false });
    m.acceptDisclaimer.mockRejectedValue(new Error('net'));
    const { result } = renderHook(() => useConsentGate());
    await waitFor(() => expect(result.current.state).toBe('needed'));
    await act(async () => { await result.current.accept(); });
    expect(result.current.state).toBe('needed');
    expect(result.current.failed).toBe(true);
  });

  it('видел экран входа: принимает тихо, один вызов', async () => {
    markLoginConsentShown();
    m.getDisclaimer.mockResolvedValue({ accepted: false });
    const { result } = renderHook(() => useConsentGate());
    await waitFor(() => expect(result.current.state).toBe('done'));
    expect(m.acceptDisclaimer).toHaveBeenCalledTimes(1);
  });

  it('сбой проверки: не запирает кабинет и шлёт отчёт', async () => {
    m.getDisclaimer.mockRejectedValue(new Error('500'));
    const { result } = renderHook(() => useConsentGate());
    await waitFor(() => expect(result.current.state).toBe('done'));
    expect(reportClientError).toHaveBeenCalledTimes(1);
    expect(m.acceptDisclaimer).not.toHaveBeenCalled();
  });
});
