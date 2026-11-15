// @vitest-environment jsdom
// Свои режимы палитры карты: сбой загрузки — 'failed' и ровно один отчёт наверх (№14), успех — без отчёта.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { ApiError } from '../../apiClient';

vi.mock('../../api', () => ({ api: { listCustomModes: vi.fn() }, reportClientError: vi.fn() }));
import { api, reportClientError, type TherapistCustomMode } from '../../api';
import { useCustomModes } from './useCustomModes';

const listCustomModes = vi.mocked(api.listCustomModes);
const MINE: TherapistCustomMode = { id: 5, therapistId: 1, name: 'Особый', emoji: '⭐', nodeType: 'healthy', createdAt: '2026-01-01' };

beforeEach(() => vi.clearAllMocks());

describe('useCustomModes', () => {
  it('сбой загрузки — failed и ровно один отчёт со статусом, без текста ответа', async () => {
    listCustomModes.mockRejectedValue(new ApiError(403, 'Therapist only'));
    const { result } = renderHook(() => useCustomModes());
    await waitFor(() => expect(result.current[0]).toBe('failed'));
    expect(reportClientError).toHaveBeenCalledTimes(1);
    expect(reportClientError).toHaveBeenCalledWith({ message: 'custom modes load failed: HTTP 403', section: 'therapist.modeMap' });
  });

  it('успех — свои режимы, отчёта нет', async () => {
    listCustomModes.mockResolvedValue([MINE]);
    const { result } = renderHook(() => useCustomModes());
    await waitFor(() => expect(result.current[0]).toEqual([MINE]));
    expect(reportClientError).not.toHaveBeenCalled();
  });
});
