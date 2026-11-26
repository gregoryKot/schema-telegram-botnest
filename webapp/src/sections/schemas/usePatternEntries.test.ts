// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('../../api', () => ({
  api: { getSchemaDiary: vi.fn(), getModeDiary: vi.fn() },
  reportClientError: vi.fn(),
}));
import { api, reportClientError } from '../../api';
import { usePatternEntries } from './usePatternEntries';

const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => vi.clearAllMocks());

describe('usePatternEntries', () => {
  it('отдаёт оба дневника и ready после загрузки', async () => {
    mockApi.getSchemaDiary.mockResolvedValue([{ id: 1 }]);
    mockApi.getModeDiary.mockResolvedValue([{ id: 2 }]);
    const { result } = renderHook(() => usePatternEntries());
    expect(result.current.ready).toBe(false);
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.schemaEntries).toEqual([{ id: 1 }]);
    expect(result.current.modeEntries).toEqual([{ id: 2 }]);
  });

  it('провал загрузки: ready остаётся false (статус не врёт «0 записей») и уходит отчёт', async () => {
    mockApi.getSchemaDiary.mockRejectedValue(new Error('down'));
    mockApi.getModeDiary.mockResolvedValue([]);
    const { result } = renderHook(() => usePatternEntries());
    await waitFor(() => expect(reportClientError).toHaveBeenCalled());
    expect(result.current.ready).toBe(false);
  });
});
