// @vitest-environment jsdom
// Ручной выбор «моих схем»/«моих режимов»: локально пишем сразу, на сервер —
// фоном. Раньше сбой синхронизации глушился `.catch(() => {})`: лист
// закрывался, выбор выглядел применённым, а при следующем заходе профиль
// подтягивался с сервера и молча откатывал его к старому. Ни ошибки, ни
// объяснения — тот самый класс багов, ради которого заведён гейт тихих catch.
//
// Поэтому здесь проверяются именно ветки отказа: флаг ошибки поднимается,
// локальный выбор при этом остаётся (человек не теряет сделанное), а
// следующее удачное сохранение флаг снимает.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useMySelections } from './useMySelections';
import { MY_SCHEMA_IDS_KEY, MY_MODE_IDS_KEY } from '../../utils/storageKeys';
import { api } from '../../api';

vi.mock('../../api', () => ({
  api: { getProfile: vi.fn(), updateSettings: vi.fn() },
}));

const mockApi = vi.mocked(api);

const profile = (over: Partial<Record<string, unknown>> = {}) => ({
  mySchemaIds: [],
  myModeIds: [],
  ysq: { activeSchemaIds: [], completedAt: null },
  ...over,
});

describe('useMySelections', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockApi.getProfile.mockResolvedValue(profile());
    mockApi.updateSettings.mockResolvedValue(undefined);
  });

  afterEach(() => vi.restoreAllMocks());

  it('профиль с сервера перекрывает локальный выбор и кэшируется в localStorage', async () => {
    localStorage.setItem(MY_SCHEMA_IDS_KEY, JSON.stringify(['old']));
    mockApi.getProfile.mockResolvedValue(
      profile({
        mySchemaIds: ['abandonment', 'mistrust'],
        myModeIds: ['vulnerable_child'],
        ysq: { activeSchemaIds: ['defectiveness'], completedAt: '2020-01-01' },
      }),
    );

    const { result } = renderHook(() => useMySelections());
    await waitFor(() => expect(result.current.profileLoading).toBe(false));

    expect(result.current.manualSchemaIds).toEqual(['abandonment', 'mistrust']);
    expect(result.current.myModeIds).toEqual(['vulnerable_child']);
    expect(result.current.ysqSchemaIds).toEqual(['defectiveness']);
    expect(result.current.ysqCompletedAt).toBe('2020-01-01');
    // Кэш обновлён — при следующем холодном старте покажется то же, что на сервере.
    expect(JSON.parse(localStorage.getItem(MY_SCHEMA_IDS_KEY)!)).toEqual([
      'abandonment',
      'mistrust',
    ]);
    expect(JSON.parse(localStorage.getItem(MY_MODE_IDS_KEY)!)).toEqual([
      'vulnerable_child',
    ]);
  });

  it('пустой ответ сервера не затирает локальный кэш', async () => {
    localStorage.setItem(MY_SCHEMA_IDS_KEY, JSON.stringify(['kept']));
    const { result } = renderHook(() => useMySelections());
    await waitFor(() => expect(result.current.profileLoading).toBe(false));

    expect(JSON.parse(localStorage.getItem(MY_SCHEMA_IDS_KEY)!)).toEqual([
      'kept',
    ]);
  });

  it('падение getProfile снимает загрузку и оставляет локальный выбор', async () => {
    localStorage.setItem(MY_SCHEMA_IDS_KEY, JSON.stringify(['local']));
    mockApi.getProfile.mockRejectedValue(new Error('offline'));

    const { result } = renderHook(() => useMySelections());
    await waitFor(() => expect(result.current.profileLoading).toBe(false));

    // Экран не висит в скелетоне и показывает то, что человек выбирал раньше.
    expect(result.current.manualSchemaIds).toEqual(['local']);
  });

  it('сбой сохранения схем поднимает флаг ошибки, выбор остаётся локально', async () => {
    mockApi.updateSettings.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useMySelections());
    await waitFor(() => expect(result.current.profileLoading).toBe(false));

    await act(async () => {
      result.current.saveSchemas(['abandonment']);
    });

    await waitFor(() => expect(result.current.schemaSaveError).toBe(true));
    expect(result.current.manualSchemaIds).toEqual(['abandonment']);
    expect(JSON.parse(localStorage.getItem(MY_SCHEMA_IDS_KEY)!)).toEqual([
      'abandonment',
    ]);
    expect(mockApi.updateSettings).toHaveBeenCalledWith({
      mySchemaIds: ['abandonment'],
    });
  });

  it('удачное сохранение после сбоя снимает флаг ошибки', async () => {
    mockApi.updateSettings.mockRejectedValueOnce(new Error('network'));
    const { result } = renderHook(() => useMySelections());
    await waitFor(() => expect(result.current.profileLoading).toBe(false));

    await act(async () => {
      result.current.saveSchemas(['abandonment']);
    });
    await waitFor(() => expect(result.current.schemaSaveError).toBe(true));

    mockApi.updateSettings.mockResolvedValue(undefined);
    await act(async () => {
      result.current.saveSchemas(['abandonment', 'mistrust']);
    });

    await waitFor(() => expect(result.current.schemaSaveError).toBe(false));
    expect(result.current.manualSchemaIds).toEqual(['abandonment', 'mistrust']);
  });

  it('сбой сохранения режимов поднимает свой флаг, не задевая схемы', async () => {
    mockApi.updateSettings.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useMySelections());
    await waitFor(() => expect(result.current.profileLoading).toBe(false));

    await act(async () => {
      result.current.saveModes(['vulnerable_child']);
    });

    await waitFor(() => expect(result.current.modeSaveError).toBe(true));
    expect(result.current.schemaSaveError).toBe(false);
    expect(result.current.myModeIds).toEqual(['vulnerable_child']);
    expect(mockApi.updateSettings).toHaveBeenCalledWith({
      myModeIds: ['vulnerable_child'],
    });
  });
});
