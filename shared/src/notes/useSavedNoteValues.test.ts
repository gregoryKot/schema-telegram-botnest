// @vitest-environment jsdom
// useSavedNoteValues — опросник карточки стартует с уже написанного, а не с
// пустой формы (иначе сохранение затирало карточку, docs/INCIDENTS.md 2026-10-31).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSavedNoteValues, noteValues } from './useSavedNoteValues';

const getSchemaNotes = vi.fn();
const getModeNotes = vi.fn();
const api = {
  getSchemaNotes: (...a: unknown[]) => getSchemaNotes(...a),
  getModeNotes: (...a: unknown[]) => getModeNotes(...a),
};

beforeEach(() => {
  getSchemaNotes.mockReset();
  getModeNotes.mockReset();
});

describe('noteValues', () => {
  it('берёт только заполненные поля, обрезая пробелы', () => {
    expect(
      noteValues(
        { triggers: ' когда молчат ', feelings: '  ', thoughts: null },
        ['triggers', 'feelings', 'thoughts'],
      ),
    ).toEqual({ triggers: 'когда молчат' });
  });
});

describe('useSavedNoteValues', () => {
  it('схема: loading до ответа, потом значения своей заметки', async () => {
    getSchemaNotes.mockResolvedValue([
      { schemaId: 'abandonment', triggers: 'чужое' },
      { schemaId: 'defectiveness', thoughts: 'со мной что-то не так' },
    ]);
    const { result } = renderHook(() =>
      useSavedNoteValues('schema', 'defectiveness', api),
    );
    expect(result.current).toEqual({
      loading: true,
      values: undefined,
      failed: false,
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.values).toEqual({
      thoughts: 'со мной что-то не так',
    });
  });

  it('режим: заметки нет — пустые значения, не выдуманные', async () => {
    getModeNotes.mockResolvedValue([{ modeId: 'angry_child', needs: 'x' }]);
    const { result } = renderHook(() =>
      useSavedNoteValues('mode', 'vulnerable_child', api),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.values).toBeUndefined();
  });

  it('preset или id = null — без запроса и без loading', () => {
    const preset = { triggers: 'готово' };
    const a = renderHook(() =>
      useSavedNoteValues('schema', 'defectiveness', api, preset),
    );
    expect(a.result.current).toEqual({
      loading: false,
      values: preset,
      failed: false,
    });
    const b = renderHook(() => useSavedNoteValues('mode', null, api));
    expect(b.result.current.loading).toBe(false);
    expect(getSchemaNotes).not.toHaveBeenCalled();
    expect(getModeNotes).not.toHaveBeenCalled();
  });

  it('смена id снова ставит loading и грузит новую заметку', async () => {
    getSchemaNotes.mockResolvedValue([
      { schemaId: 'abandonment', triggers: 'A' },
      { schemaId: 'defectiveness', triggers: 'D' },
    ]);
    const { result, rerender } = renderHook(
      ({ id }) => useSavedNoteValues('schema', id, api),
      { initialProps: { id: 'abandonment' } },
    );
    await waitFor(() =>
      expect(result.current.values).toEqual({ triggers: 'A' }),
    );
    rerender({ id: 'defectiveness' });
    expect(result.current.loading).toBe(true);
    await waitFor(() =>
      expect(result.current.values).toEqual({ triggers: 'D' }),
    );
  });

  it('ошибка загрузки — пустая форма, не вечный скелетон', async () => {
    getSchemaNotes.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() =>
      useSavedNoteValues('schema', 'defectiveness', api),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.values).toBeUndefined();
    expect(result.current.failed).toBe(true);
  });
});
