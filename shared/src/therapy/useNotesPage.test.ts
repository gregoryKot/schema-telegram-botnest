// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { TherapistNote } from '../apiTypes';
import { useNotesPage } from './useNotesPage';

const note = (id: number, date: string) =>
  ({
    id,
    date,
    createdAt: `${date}T10:00:00.000Z`,
    text: `n${id}`,
  }) as TherapistNote;

describe('useNotesPage', () => {
  it('сохранение и удаление двигают список и total вместе', () => {
    const { result } = renderHook(() => useNotesPage());
    act(() =>
      result.current.setNotesPage({
        notes: [note(1, '2026-01-01')],
        total: 105,
      }),
    );
    act(() => result.current.onNoteSaved(note(2, '2026-02-01')));
    expect(result.current.notesPage.total).toBe(106);
    expect(result.current.notesPage.notes.map((n) => n.id)).toEqual([2, 1]);
    act(() => result.current.onNoteDeleted(1));
    expect(result.current.notesPage.total).toBe(105);
    act(() => result.current.onNoteDeleted(999));
    expect(result.current.notesPage.total).toBe(105);
  });

  it('resetNotesPage возвращает пустую страницу', () => {
    const { result } = renderHook(() => useNotesPage());
    act(() => result.current.onNoteSaved(note(1, '2026-01-01')));
    act(() => result.current.resetNotesPage());
    expect(result.current.notesPage).toEqual({ notes: [], total: 0 });
  });
});
