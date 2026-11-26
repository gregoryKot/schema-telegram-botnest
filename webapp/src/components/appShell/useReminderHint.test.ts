// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const getSettings = vi.fn();
vi.mock('../../api', () => ({ api: { getSettings: () => getSettings() }, reportClientError: vi.fn() }));

import { useReminderHint } from './useReminderHint';
import { hasReminderHintSeen, markReminderHintSeen } from './reminderHintSeen';

const on = { notifyEnabled: true, notifyReminderEnabled: true, notifyLocalHour: 21 };

beforeEach(() => { localStorage.clear(); getSettings.mockReset(); });

describe('useReminderHint', () => {
  it('флаг стоит — сразу skip, настройки не грузятся', () => {
    markReminderHintSeen();
    const { result } = renderHook(() => useReminderHint(true));
    expect(result.current.state).toBe('skip');
    expect(getSettings).not.toHaveBeenCalled();
  });

  it('очередь не дошла до шага — запроса нет', () => {
    renderHook(() => useReminderHint(false));
    expect(getSettings).not.toHaveBeenCalled();
  });

  it('напоминание включено — show с настройками', async () => {
    getSettings.mockResolvedValue(on);
    const { result } = renderHook(() => useReminderHint(true));
    await waitFor(() => expect(result.current.state).toBe('show'));
    expect(result.current.settings).toEqual(on);
  });

  it('напоминание выключено — skip', async () => {
    getSettings.mockResolvedValue({ ...on, notifyReminderEnabled: false });
    const { result } = renderHook(() => useReminderHint(true));
    await waitFor(() => expect(result.current.state).toBe('skip'));
  });

  it('сбой загрузки — skip, флаг не ставится', async () => {
    getSettings.mockRejectedValue(new Error('net'));
    const { result } = renderHook(() => useReminderHint(true));
    await waitFor(() => expect(result.current.state).toBe('skip'));
    expect(hasReminderHintSeen()).toBe(false);
  });
});
