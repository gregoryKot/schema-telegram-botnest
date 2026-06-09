import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAddClient } from './useAddClient';

// ── Mock api ─────────────────────────────────────────────────────────────────
vi.mock('../../api', () => ({
  api: {
    addVirtualClient: vi.fn(),
    createTherapyInvite: vi.fn(),
  },
}));

import { api } from '../../api';

const mockApi = api as {
  addVirtualClient: ReturnType<typeof vi.fn>;
  createTherapyInvite: ReturnType<typeof vi.fn>;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeSetClients() {
  return vi.fn();
}

beforeEach(() => {
  vi.clearAllMocks();
  // Silence clipboard errors in jsdom
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('useAddClient', () => {
  it('initialises with empty state', () => {
    const { result } = renderHook(() => useAddClient({ setClients: makeSetClients() }));
    expect(result.current.name).toBe('');
    expect(result.current.withInvite).toBe(false);
    expect(result.current.created).toBeNull();
    expect(result.current.submitting).toBe(false);
    expect(result.current.error).toBe('');
    expect(result.current.copied).toBe(false);
  });

  it('valid is false when name < 2 chars', () => {
    const { result } = renderHook(() => useAddClient({ setClients: makeSetClients() }));
    act(() => { result.current.setName('A'); });
    expect(result.current.valid).toBe(false);
    act(() => { result.current.setName('AB'); });
    expect(result.current.valid).toBe(true);
  });

  it('submit without valid name does not call api', async () => {
    const setClients = makeSetClients();
    const { result } = renderHook(() => useAddClient({ setClients }));
    // name is empty — not valid
    await act(async () => { await result.current.submit(); });
    expect(mockApi.addVirtualClient).not.toHaveBeenCalled();
  });

  it('submit with valid name calls addVirtualClient and sets created', async () => {
    const setClients = makeSetClients();
    const updatedClients = [{ telegramId: 1, name: null, clientAlias: 'Иван' }];
    mockApi.addVirtualClient.mockResolvedValue(updatedClients);

    const { result } = renderHook(() => useAddClient({ setClients }));
    act(() => { result.current.setName('Иван'); });
    await act(async () => { await result.current.submit(); });

    expect(mockApi.addVirtualClient).toHaveBeenCalledWith('Иван');
    expect(setClients).toHaveBeenCalledWith(updatedClients);
    expect(result.current.created).toEqual({ name: 'Иван', inviteUrl: null });
    expect(result.current.name).toBe(''); // cleared after submit
    expect(mockApi.createTherapyInvite).not.toHaveBeenCalled();
  });

  it('submit with withInvite=true also calls createTherapyInvite', async () => {
    const setClients = makeSetClients();
    mockApi.addVirtualClient.mockResolvedValue([]);
    mockApi.createTherapyInvite.mockResolvedValue({ code: 'abc', url: 'https://t.me/bot?start=abc' });

    const { result } = renderHook(() => useAddClient({ setClients }));
    act(() => {
      result.current.setName('Мария');
      result.current.setWithInvite(true);
    });
    await act(async () => { await result.current.submit(); });

    expect(mockApi.createTherapyInvite).toHaveBeenCalledTimes(1);
    expect(result.current.created).toEqual({
      name: 'Мария',
      inviteUrl: 'https://t.me/bot?start=abc',
    });
  });

  it('trims whitespace from name before submit', async () => {
    const setClients = makeSetClients();
    mockApi.addVirtualClient.mockResolvedValue([]);

    const { result } = renderHook(() => useAddClient({ setClients }));
    act(() => { result.current.setName('  Пётр  '); });
    await act(async () => { await result.current.submit(); });

    expect(mockApi.addVirtualClient).toHaveBeenCalledWith('Пётр');
    expect(result.current.created?.name).toBe('Пётр');
  });

  it('sets error when addVirtualClient throws', async () => {
    const setClients = makeSetClients();
    mockApi.addVirtualClient.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useAddClient({ setClients }));
    act(() => { result.current.setName('Тест'); });
    await act(async () => { await result.current.submit(); });

    expect(result.current.error).toBe('Network error');
    expect(result.current.created).toBeNull();
  });

  it('does not call createTherapyInvite if addVirtualClient fails', async () => {
    const setClients = makeSetClients();
    mockApi.addVirtualClient.mockRejectedValue(new Error('fail'));

    const { result } = renderHook(() => useAddClient({ setClients }));
    act(() => {
      result.current.setName('Тест');
      result.current.setWithInvite(true);
    });
    await act(async () => { await result.current.submit(); });

    expect(mockApi.createTherapyInvite).not.toHaveBeenCalled();
  });

  it('reset clears created state and resets toggles', async () => {
    const setClients = makeSetClients();
    mockApi.addVirtualClient.mockResolvedValue([]);

    const { result } = renderHook(() => useAddClient({ setClients }));
    act(() => {
      result.current.setName('Тест');
      result.current.setWithInvite(true);
    });
    await act(async () => { await result.current.submit(); });
    expect(result.current.created).not.toBeNull();

    act(() => { result.current.reset(); });
    expect(result.current.created).toBeNull();
    expect(result.current.withInvite).toBe(false);
    expect(result.current.error).toBe('');
    expect(result.current.copied).toBe(false);
  });

  it('copyInvite writes to clipboard and sets copied flag', async () => {
    const setClients = makeSetClients();
    mockApi.addVirtualClient.mockResolvedValue([]);
    mockApi.createTherapyInvite.mockResolvedValue({ code: 'x', url: 'https://example.com/invite' });

    const { result } = renderHook(() => useAddClient({ setClients }));
    act(() => {
      result.current.setName('Копия');
      result.current.setWithInvite(true);
    });
    await act(async () => { await result.current.submit(); });
    expect(result.current.created?.inviteUrl).toBe('https://example.com/invite');

    await act(async () => { await result.current.copyInvite(); });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://example.com/invite');
    expect(result.current.copied).toBe(true);
  });

  it('copyInvite does nothing when created has no inviteUrl', async () => {
    const setClients = makeSetClients();
    mockApi.addVirtualClient.mockResolvedValue([]);

    const { result } = renderHook(() => useAddClient({ setClients }));
    act(() => { result.current.setName('Без ссылки'); });
    await act(async () => { await result.current.submit(); });
    expect(result.current.created?.inviteUrl).toBeNull();

    await act(async () => { await result.current.copyInvite(); });
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
  });
});
