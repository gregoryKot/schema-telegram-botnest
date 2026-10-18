// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const getSchemaNotes = vi.fn();
const getModeNotes = vi.fn().mockResolvedValue([]);
const api = {
  getSchemaNotes: (...a: unknown[]) => getSchemaNotes(...a),
  getModeNotes: (...a: unknown[]) => getModeNotes(...a),
};

import { usePatternStatus } from './usePatternStatus';

beforeEach(() => {
  getSchemaNotes.mockReset();
});

describe('usePatternStatus', () => {
  it('заполненная заметка → статус «заполнена» со счётчиком записей из entryCounts', async () => {
    getSchemaNotes.mockResolvedValue([
      {
        schemaId: 'abandonment',
        triggers: 'Когда не отвечают',
        feelings: '',
        thoughts: '',
        origins: '',
        reality: '',
        healthyView: '',
        behavior: '',
        updatedAt: '2026-01-01',
      },
    ]);
    const { result } = renderHook(() =>
      usePatternStatus('schema', { abandonment: 3 }, api),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.statusFor('abandonment')).toBe(
      'карточка заполнена · 3 записи',
    );
  });

  it('нет заметки для id → «карточка пока пустая», даже если записи дневника есть', async () => {
    getSchemaNotes.mockResolvedValue([]);
    const { result } = renderHook(() =>
      usePatternStatus('schema', { abandonment: 5 }, api),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.statusFor('abandonment')).toBe(
      'карточка пока пустая',
    );
  });

  it('режимы: заметка режима → «заполнена», записей нет — без счётчика', async () => {
    getModeNotes.mockResolvedValue([
      {
        modeId: 'vulnerable_child',
        triggers: 'Одиночество',
        feelings: '',
        thoughts: '',
        behavior: '',
        modeFunction: '',
        needs: '',
        needsMet: '',
        origins: '',
        healthyView: '',
        updatedAt: '2026-01-01',
      },
    ]);
    const { result } = renderHook(() => usePatternStatus('mode', {}, api));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.statusFor('vulnerable_child')).toBe(
      'карточка заполнена',
    );
  });
});
