// @vitest-environment jsdom
// Отказ записи «моих схем/режимов» с 409 unreadable_data: прежний список на
// сервере не читается, и сервер не дал его стереть. Экран отличает этот отказ
// от обрыва связи (saveBlocked), а выбор человека остаётся на устройстве.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSchemasData } from './useSchemasData';
import { MY_SCHEMA_IDS_KEY, MY_MODE_IDS_KEY } from '../../utils/storageKeys';

vi.mock('../../api', () => ({
  api: {
    getProfile: vi.fn(),
    getYsqHistory: vi.fn(),
    getYsqProgress: vi.fn(),
    listMyModeMaps: vi.fn(),
    updateSettings: vi.fn(),
  },
  reportClientError: vi.fn(),
}));
import { api, reportClientError } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

const unwritable = Object.assign(new Error('Правка не сохранена'), { status: 409, reason: 'unreadable_data' });

async function mounted() {
  const hook = renderHook(() => useSchemasData());
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}

describe('useSchemasData — отказ записи поверх нечитаемого списка', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mockApi.getProfile.mockResolvedValue({ mySchemaIds: [], myModeIds: [], ysq: { activeSchemaIds: [], completedAt: null } });
    mockApi.getYsqHistory.mockResolvedValue([]);
    mockApi.getYsqProgress.mockResolvedValue(null);
    mockApi.listMyModeMaps.mockResolvedValue([]);
  });

  it('409 unreadable_data на схемах → saveBlocked, выбор остался в state и localStorage', async () => {
    mockApi.updateSettings.mockRejectedValue(unwritable);
    const { result } = await mounted();
    await act(async () => { result.current.saveSchemas(['abandonment']); });

    await waitFor(() => expect(result.current.saveBlocked).toBe(true));
    expect(result.current.saveFailed).toBe(true);
    expect(result.current.manualSchemaIds).toEqual(['abandonment']);
    expect(JSON.parse(localStorage.getItem(MY_SCHEMA_IDS_KEY)!)).toEqual(['abandonment']);
    expect(reportClientError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('mySchemaIds') }));
  });

  it('409 unreadable_data на режимах → saveBlocked, выбор режимов сохранён локально', async () => {
    mockApi.updateSettings.mockRejectedValue(unwritable);
    const { result } = await mounted();
    await act(async () => { result.current.saveModes(['vulnerable_child']); });

    await waitFor(() => expect(result.current.saveBlocked).toBe(true));
    expect(result.current.myModeIds).toEqual(['vulnerable_child']);
    expect(JSON.parse(localStorage.getItem(MY_MODE_IDS_KEY)!)).toEqual(['vulnerable_child']);
  });

  it('контроль: обрыв сети — saveFailed без saveBlocked', async () => {
    mockApi.updateSettings.mockRejectedValue(new TypeError('Failed to fetch'));
    const { result } = await mounted();
    await act(async () => { result.current.saveSchemas(['abandonment']); });

    await waitFor(() => expect(result.current.saveFailed).toBe(true));
    expect(result.current.saveBlocked).toBe(false);
  });

  it('контроль: удачная запись после отказа снимает оба флага', async () => {
    mockApi.updateSettings.mockRejectedValueOnce(unwritable).mockResolvedValue(undefined);
    const { result } = await mounted();
    await act(async () => { result.current.saveSchemas(['abandonment']); });
    await waitFor(() => expect(result.current.saveBlocked).toBe(true));
    await act(async () => { result.current.saveSchemas(['mistrust']); });

    await waitFor(() => expect(result.current.saveFailed).toBe(false));
    expect(result.current.saveBlocked).toBe(false);
  });
});
