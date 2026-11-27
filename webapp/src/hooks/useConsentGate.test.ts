// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../api', () => ({
  api: { getDisclaimer: vi.fn(), acceptDisclaimer: vi.fn() },
  reportClientError: vi.fn(),
}));
import { api, reportClientError } from '../api';
import { rememberLoginConsent } from '../auth/loginConsent';
import { CONSENT_VERSION } from '../../../shared/src/onboarding/consents';
import { useConsentGate } from './useConsentGate';

const m = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  m.acceptDisclaimer.mockResolvedValue(undefined);
});

describe('useConsentGate', () => {
  it('accepted: true: экрана нет, согласие не пишется', async () => {
    m.getDisclaimer.mockResolvedValue({ accepted: true, version: CONSENT_VERSION });
    const { result } = renderHook(() => useConsentGate());
    await waitFor(() => expect(result.current.state).toBe('done'));
    expect(m.acceptDisclaimer).not.toHaveBeenCalled();
  });

  it('accepted: false: нужен экран, acceptDisclaimer не зван до accept()', async () => {
    m.getDisclaimer.mockResolvedValue({ accepted: false, version: null });
    const { result } = renderHook(() => useConsentGate());
    await waitFor(() => expect(result.current.state).toBe('needed'));
    expect(m.acceptDisclaimer).not.toHaveBeenCalled();
    await act(async () => { await result.current.accept(); });
    expect(m.acceptDisclaimer).toHaveBeenCalledWith(CONSENT_VERSION);
    expect(result.current.state).toBe('done');
  });

  it('сбой accept(): остаёмся на экране с признаком ошибки', async () => {
    m.getDisclaimer.mockResolvedValue({ accepted: false, version: null });
    m.acceptDisclaimer.mockRejectedValue(new Error('net'));
    const { result } = renderHook(() => useConsentGate());
    await waitFor(() => expect(result.current.state).toBe('needed'));
    await act(async () => { await result.current.accept(); });
    expect(result.current.state).toBe('needed');
    expect(result.current.failed).toBe(true);
  });

  it('отметил галочку на входе (эта редакция): принимает тихо с версией, один вызов, отметка снята', async () => {
    rememberLoginConsent(CONSENT_VERSION);
    m.getDisclaimer.mockResolvedValue({ accepted: false, version: null });
    const { result } = renderHook(() => useConsentGate());
    await waitFor(() => expect(result.current.state).toBe('done'));
    expect(m.acceptDisclaimer).toHaveBeenCalledTimes(1);
    expect(m.acceptDisclaimer).toHaveBeenCalledWith(CONSENT_VERSION);
    expect(localStorage.getItem('login_consent_given')).toBeNull();
  });

  it('отметка другой редакции не принимается; отметка снимается и тут', async () => {
    rememberLoginConsent('2020-01-01');
    m.getDisclaimer.mockResolvedValue({ accepted: false, version: null });
    const { result } = renderHook(() => useConsentGate());
    await waitFor(() => expect(result.current.state).toBe('needed'));
    expect(m.acceptDisclaimer).not.toHaveBeenCalled();
    expect(localStorage.getItem('login_consent_given')).toBeNull();
  });

  it('согласие на старую редакцию или без версии: renew, не тихо', async () => {
    m.getDisclaimer.mockResolvedValue({ accepted: true, version: '2020-01-01' });
    const old = renderHook(() => useConsentGate());
    await waitFor(() => expect(old.result.current.state).toBe('renew'));
    m.getDisclaimer.mockResolvedValue({ accepted: true, version: null });
    const none = renderHook(() => useConsentGate());
    await waitFor(() => expect(none.result.current.state).toBe('renew'));
    expect(m.acceptDisclaimer).not.toHaveBeenCalled();
  });

  it('сбой проверки: не запирает кабинет и шлёт отчёт', async () => {
    m.getDisclaimer.mockRejectedValue(new Error('500'));
    const { result } = renderHook(() => useConsentGate());
    await waitFor(() => expect(result.current.state).toBe('done'));
    expect(reportClientError).toHaveBeenCalledTimes(1);
    expect(m.acceptDisclaimer).not.toHaveBeenCalled();
  });
});
