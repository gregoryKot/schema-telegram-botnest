import { useState } from 'react';
import type { TherapistNote } from '../apiTypes';
import type { UserId } from '../userId';
import { sameId } from '../utils/sameId';
import { todayStr } from '../utils/format';
import { useNotesPage } from './useNotesPage';
import { normalizeSessionWork } from './sessionWork/normalize';
import type { SessionWorkItem } from './sessionWork/types';

// «Новая заметка» по сессии у терапевта — одна механика на оба фронта (правило №3). Черновик сбрасывается
// сменой клиента (resetNotes); ответ, пришедший после перехода, в карточку другого клиента не попадает.
// Дата пустая — сегодня. «Что делали» (#1330) уходит в каноническом виде; «Из плана» (#1522) — id пунктов.

export interface NoteSenders {
  create: (
    clientId: UserId,
    date: string,
    text: string,
    work: SessionWorkItem[],
    planItemIds: number[],
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
  const [newNotePlanIds, setNewNotePlanIds] = useState<number[]>([]);
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
    setNewNotePlanIds([]);
    setNoteSaving(false);
  }

  async function addNote() {
    const clientId = openClientIdRef.current;
    const work = normalizeSessionWork(newNoteWork);
    if (clientId == null || (!newNoteText.trim() && work.length === 0 && newNotePlanIds.length === 0)) return;
    setNoteSaving(true);
    setNoteError('');
    try {
      const note = await send.create(
        clientId,
        newNoteDate || todayStr(),
        newNoteText.trim(),
        work,
        newNotePlanIds,
      );
      if (work.length > 0) send.onWorkSaved?.(work);
      if (!isOpen(clientId)) return;
      np.onNoteSaved(note);
      setNewNoteText('');
      setNewNoteDate('');
      setNewNoteWork([]);
      setNewNotePlanIds([]);
    } catch {
      if (isOpen(clientId)) setNoteError('Не удалось сохранить заметку');
    } finally {
      if (isOpen(clientId)) setNoteSaving(false);
    }
  }

  /** true — заметка удалена на сервере. */
  async function removeNote(noteId: number): Promise<boolean> {
    const clientId = openClientIdRef.current;
    try {
      await send.remove(noteId);
      if (isOpen(clientId)) np.onNoteDeleted(noteId);
      return true;
    } catch {
      if (isOpen(clientId)) setNoteError('Не удалось удалить заметку');
      return false;
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
    newNotePlanIds,
    setNewNotePlanIds,
    noteSaving,
    noteError,
    setNoteError,
    addNote,
    removeNote,
  };
}
