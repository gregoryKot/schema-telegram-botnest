import { useState } from 'react';
import type { TherapistNote } from '../apiTypes';
import type { UserId } from '../userId';
import { sameId } from '../utils/sameId';
import { todayStr } from '../utils/format';
import { useNotesPage } from './useNotesPage';
import { normalizeSessionWork } from './sessionWork/normalize';
import type { SessionWorkItem } from './sessionWork/types';

// «Новая заметка» по сессии в карточке клиента у терапевта — одна механика
// на оба фронта (правило №3): до инцидента 2026-10-26 (docs/INCIDENTS.md)
// она жила двумя копиями в useClientDetail сайта и мини-аппа, и обе теряли
// привязку к клиенту. Черновик (текст, дата) сбрасывается сменой клиента
// (`resetNotes` из openClient), иначе «Сохранить» писал заметку следующему.
// Ответ, пришедший после перехода, в карточку другого клиента не попадает:
// заметка уже сохранена своему, а список, черновик и флаги на экране — чужие.
// Дата пустая — сегодняшний день (мини-апп даты не выбирает).
// «Что делали» (#1330): пункты уходят в каноническом виде; с пунктами текст
// может быть пустым.

export interface NoteSenders {
  create: (
    clientId: UserId,
    date: string,
    text: string,
    work: SessionWorkItem[],
  ) => Promise<TherapistNote>;
  remove: (noteId: number) => Promise<unknown>;
  /** Запись сохранена с пунктами «Что делали» — событие аналитики. */
  onWorkSaved?: (work: SessionWorkItem[]) => void;
}

export function useNoteComposer(
  openClientIdRef: { readonly current: UserId | null },
  send: NoteSenders,
) {
  const np = useNotesPage();
  const [newNoteText, setNewNoteText] = useState('');
  const [newNoteDate, setNewNoteDate] = useState('');
  const [newNoteWork, setNewNoteWork] = useState<SessionWorkItem[]>([]);
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteError, setNoteError] = useState('');
  const isOpen = (id: UserId | null): id is UserId =>
    id != null && sameId(openClientIdRef.current, id);

  function resetNotes() {
    np.resetNotesPage();
    setNoteError('');
    setNewNoteText('');
    setNewNoteDate('');
    setNewNoteWork([]);
    setNoteSaving(false);
  }

  async function addNote() {
    const clientId = openClientIdRef.current;
    const work = normalizeSessionWork(newNoteWork);
    if (clientId == null || (!newNoteText.trim() && work.length === 0)) return;
    setNoteSaving(true);
    setNoteError('');
    try {
      const note = await send.create(
        clientId,
        newNoteDate || todayStr(),
        newNoteText.trim(),
        work,
      );
      if (work.length > 0) send.onWorkSaved?.(work);
      if (!isOpen(clientId)) return;
      np.onNoteSaved(note);
      setNewNoteText('');
      setNewNoteDate('');
      setNewNoteWork([]);
    } catch {
      if (isOpen(clientId)) setNoteError('Не удалось сохранить заметку');
    } finally {
      if (isOpen(clientId)) setNoteSaving(false);
    }
  }

  async function removeNote(noteId: number) {
    const clientId = openClientIdRef.current;
    try {
      await send.remove(noteId);
      if (isOpen(clientId)) np.onNoteDeleted(noteId);
    } catch {
      if (isOpen(clientId)) setNoteError('Не удалось удалить заметку');
    }
  }

  return {
    notesPage: np.notesPage,
    setNotesPage: np.setNotesPage,
    resetNotesPage: np.resetNotesPage,
    resetNotes,
    newNoteText,
    setNewNoteText,
    newNoteDate,
    setNewNoteDate,
    newNoteWork,
    setNewNoteWork,
    noteSaving,
    noteError,
    setNoteError,
    addNote,
    removeNote,
  };
}
