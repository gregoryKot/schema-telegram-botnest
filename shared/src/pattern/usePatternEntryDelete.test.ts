// @vitest-environment jsdom
// usePatternEntryDelete — удаление записи дневника из экрана паттерна той же
// механикой, что в «Записях» (deleteDiaryEntry): запись уходит из списка
// только после ответа сервера, 404 — записи уже нет (успех), любой другой
// отказ пробрасывается — кнопка покажет deleteFailedText, запись на месте.
// Регрессия (docs/open/frontend-ux.md): раньше удаление было оптимистичным,
// отказ уходил в console.error, а запись молча возвращалась без единого слова.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useState } from 'react';
import { usePatternEntryDelete } from './usePatternEntryDelete';
import type { SchemaDiaryEntry, ModeDiaryEntry } from '../types';

const deleteSchemaDiary = vi.fn();
const deleteModeDiary = vi.fn();
const deleteGratitudeDiary = vi.fn();
const api = { deleteSchemaDiary, deleteModeDiary, deleteGratitudeDiary };

afterEach(() => {
  deleteSchemaDiary.mockReset();
  deleteModeDiary.mockReset();
  deleteGratitudeDiary.mockReset();
});

const ENTRY = {
  id: 1,
  schemaIds: ['abandonment'],
} as unknown as SchemaDiaryEntry;
const MODE_ENTRY = {
  id: 7,
  modeId: 'vulnerable_child',
} as unknown as ModeDiaryEntry;

function setup() {
  return renderHook(() => {
    const [schemaEntries, setSchemaEntries] = useState([ENTRY]);
    const deleteEntry = usePatternEntryDelete({
      api,
      kind: 'schema',
      setSchemaEntries,
    });
    return { schemaEntries, deleteEntry };
  });
}

// Вторая ветка: дневник режимов — свой список и свой вызов API.
function setupMode() {
  return renderHook(() => {
    const [modeEntries, setModeEntries] = useState([MODE_ENTRY]);
    const deleteEntry = usePatternEntryDelete({
      api,
      kind: 'mode',
      setModeEntries,
    });
    return { modeEntries, deleteEntry };
  });
}

const httpError = (status: number) =>
  Object.assign(new Error(`HTTP ${status}`), { status });

describe('usePatternEntryDelete — схемы', () => {
  it('успех: запись уходит из списка после ответа сервера', async () => {
    deleteSchemaDiary.mockResolvedValue(undefined);
    const { result } = setup();
    await act(() => result.current.deleteEntry(1));
    expect(deleteSchemaDiary).toHaveBeenCalledWith(1);
    expect(result.current.schemaEntries).toHaveLength(0);
  });

  it('пока запрос идёт, запись на месте (не оптимистично)', async () => {
    let resolve!: () => void;
    deleteSchemaDiary.mockReturnValue(
      new Promise<void>((r) => {
        resolve = r;
      }),
    );
    const { result } = setup();
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.deleteEntry(1);
    });
    expect(result.current.schemaEntries).toHaveLength(1);
    await act(async () => {
      resolve();
      await pending;
    });
    expect(result.current.schemaEntries).toHaveLength(0);
  });

  it('отказ сервера: промис отклоняется (кнопке — текст сбоя), запись на месте', async () => {
    deleteSchemaDiary.mockRejectedValue(httpError(500));
    const { result } = setup();
    await act(async () => {
      await expect(result.current.deleteEntry(1)).rejects.toThrow('HTTP 500');
    });
    expect(result.current.schemaEntries).toEqual([ENTRY]);
  });

  it('404 — записи уже нет: это успех, запись уходит из списка', async () => {
    deleteSchemaDiary.mockRejectedValue(httpError(404));
    const { result } = setup();
    await act(() => result.current.deleteEntry(1));
    expect(result.current.schemaEntries).toHaveLength(0);
  });
});

describe('usePatternEntryDelete — режимы', () => {
  it('успех: зовётся deleteModeDiary, запись уходит', async () => {
    deleteModeDiary.mockResolvedValue(undefined);
    const { result } = setupMode();
    await act(() => result.current.deleteEntry(7));
    expect(deleteModeDiary).toHaveBeenCalledWith(7);
    expect(deleteSchemaDiary).not.toHaveBeenCalled();
    expect(result.current.modeEntries).toHaveLength(0);
  });

  it('отказ сервера: промис отклоняется, запись на месте', async () => {
    deleteModeDiary.mockRejectedValue(new TypeError('Failed to fetch'));
    const { result } = setupMode();
    await act(async () => {
      await expect(result.current.deleteEntry(7)).rejects.toThrow(
        'Failed to fetch',
      );
    });
    expect(result.current.modeEntries).toEqual([MODE_ENTRY]);
  });
});
