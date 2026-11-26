import { useCallback, useState } from 'react';
import type { TherapistNote } from '../apiTypes';
import {
  EMPTY_NOTES_PAGE,
  addNoteToPage,
  removeNoteFromPage,
  type TherapistNotesPage,
} from './notesPage';

/**
 * Состояние страницы заметок сессий для кабинета терапевта (оба фронта):
 * список + total, сохранение/удаление правят их вместе, а не по отдельности.
 */
export function useNotesPage() {
  const [notesPage, setNotesPage] =
    useState<TherapistNotesPage>(EMPTY_NOTES_PAGE);
  const resetNotesPage = useCallback(() => setNotesPage(EMPTY_NOTES_PAGE), []);
  const onNoteSaved = useCallback(
    (note: TherapistNote) => setNotesPage((p) => addNoteToPage(p, note)),
    [],
  );
  const onNoteDeleted = useCallback(
    (id: number) => setNotesPage((p) => removeNoteFromPage(p, id)),
    [],
  );
  return {
    notesPage,
    setNotesPage,
    resetNotesPage,
    onNoteSaved,
    onNoteDeleted,
  };
}
