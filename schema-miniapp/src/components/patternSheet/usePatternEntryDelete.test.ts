// @vitest-environment jsdom
// usePatternEntryDelete — удаление записи дневника оптимистично, с откатом
// при провале API (regression: check-silent-catch — раньше .catch(() => {})
// молча проглатывал провал, запись пропадала из UI навсегда).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { usePatternEntryDelete } from './usePatternEntryDelete';
import type { SchemaDiaryEntry, ModeDiaryEntry } from '../../types';

const deleteSchemaDiary = vi.fn();
const deleteModeDiary = vi.fn();
vi.mock('../../api', () => ({
  api: {
    deleteSchemaDiary: (...a: unknown[]) => deleteSchemaDiary(...a),
    deleteModeDiary: (...a: unknown[]) => deleteModeDiary(...a),
  },
}));

afterEach(() => {
  vi.restoreAllMocks();
  deleteSchemaDiary.mockReset();
  deleteModeDiary.mockReset();
});

const ENTRY: SchemaDiaryEntry = {
  id: 1,
  schemaIds: ['abandonment'],
  trigger: 'T',
  thought: '',
  feeling: '',
  reaction: '',
  createdAt: '2026-01-01',
} as unknown as SchemaDiaryEntry;

function setup() {
  return renderHook(() => {
    const [schemaEntries, setSchemaEntries] = useState([ENTRY]);
    const deleteEntry = usePatternEntryDelete({
      kind: 'schema',
      schemaEntries,
      setSchemaEntries,
      modeEntries: [],
      setModeEntries: undefined,
    });
    return { schemaEntries, deleteEntry };
  });
}

const MODE_ENTRY: ModeDiaryEntry = {
  id: 7,
  modeId: 'vulnerable_child',
  note: 'N',
  createdAt: '2026-01-01',
} as unknown as ModeDiaryEntry;

// Вторая ветка хука. Дневник режимов — отдельный список и отдельный вызов
// API, и раньше провал так же молча съедал запись; ветка обязана
// откатываться ровно так же, иначе фикс сделан наполовину.
function setupMode() {
  return renderHook(() => {
    const [modeEntries, setModeEntries] = useState([MODE_ENTRY]);
    const deleteEntry = usePatternEntryDelete({
      kind: 'mode',
      schemaEntries: [],
      setSchemaEntries: undefined,
      modeEntries,
      setModeEntries,
    });
    return { modeEntries, deleteEntry };
  });
}

describe('usePatternEntryDelete', () => {
  it('успех: запись остаётся убранной', async () => {
    deleteSchemaDiary.mockResolvedValue(undefined);
    const { result } = setup();
    act(() => result.current.deleteEntry(1));
    expect(result.current.schemaEntries).toHaveLength(0);
    await waitFor(() => expect(deleteSchemaDiary).toHaveBeenCalledWith(1));
    expect(result.current.schemaEntries).toHaveLength(0);
  });

  it('провал API: запись возвращается в список', async () => {
    deleteSchemaDiary.mockRejectedValue(new Error('network'));
    const { result } = setup();
    act(() => result.current.deleteEntry(1));
    expect(result.current.schemaEntries).toHaveLength(0);
    await waitFor(() => expect(result.current.schemaEntries).toHaveLength(1));
    expect(result.current.schemaEntries[0].id).toBe(1);
  });

  it('режимы, успех: зовётся deleteModeDiary, запись остаётся убранной', async () => {
    deleteModeDiary.mockResolvedValue(undefined);
    const { result } = setupMode();
    act(() => result.current.deleteEntry(7));
    expect(result.current.modeEntries).toHaveLength(0);
    await waitFor(() => expect(deleteModeDiary).toHaveBeenCalledWith(7));
    expect(deleteSchemaDiary).not.toHaveBeenCalled();
    expect(result.current.modeEntries).toHaveLength(0);
  });

  it('режимы, провал API: запись возвращается в список', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    deleteModeDiary.mockRejectedValue(new Error('network'));
    const { result } = setupMode();
    act(() => result.current.deleteEntry(7));
    expect(result.current.modeEntries).toHaveLength(0);
    await waitFor(() => expect(result.current.modeEntries).toHaveLength(1));
    expect(result.current.modeEntries[0].id).toBe(7);
  });

  it('неизвестный id: список не меняется, вернувшейся из ниоткуда записи нет', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    deleteSchemaDiary.mockRejectedValue(new Error('network'));
    const { result } = setup();
    act(() => result.current.deleteEntry(999));
    await waitFor(() => expect(deleteSchemaDiary).toHaveBeenCalledWith(999));
    // Ничего не удаляли — значит и возвращать нечего: ровно одна запись.
    expect(result.current.schemaEntries).toHaveLength(1);
  });
});
