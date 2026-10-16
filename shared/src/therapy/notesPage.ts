import type { TherapistNote } from '../apiTypes';

/**
 * Страница заметок сессий: свежие `notes` (сервер режет по 100) и `total` —
 * сколько всего заметок у клиента. total > notes.length = есть более ранние,
 * не показанные; «Сессия N» считается от total, а не от среза.
 */
export interface TherapistNotesPage {
  notes: TherapistNote[];
  total: number;
}

export const EMPTY_NOTES_PAGE: TherapistNotesPage = { notes: [], total: 0 };

type NoteKey = Pick<TherapistNote, 'id' | 'date' | 'createdAt'>;

/**
 * Порядок сессий по возрастанию: дата, при равной — время создания, затем id.
 * По нему считается «Сессия N». Бэкенд режет страницу в обратном порядке
 * (SESSION_NOTES_ORDER в src/therapy/session-notes-page.ts) — отрезаются
 * ровно самые ранние по номеру, и номера показанных не сдвигаются.
 */
export function compareNotesAsc(a: NoteKey, b: NoteKey): number {
  return (
    a.date.localeCompare(b.date) ||
    a.createdAt.localeCompare(b.createdAt) ||
    a.id - b.id
  );
}

/** Заметка, только что сохранённая на сервере: встаёт на своё место, total растёт. */
export function addNoteToPage(
  page: TherapistNotesPage,
  note: TherapistNote,
): TherapistNotesPage {
  const notes = [...page.notes, note].sort((a, b) => compareNotesAsc(b, a));
  return { notes, total: page.total + 1 };
}

/** Удалённая заметка: total уменьшается, только если она была в показанных. */
export function removeNoteFromPage(
  page: TherapistNotesPage,
  id: number,
): TherapistNotesPage {
  const notes = page.notes.filter((n) => n.id !== id);
  if (notes.length === page.notes.length) return page;
  return { notes, total: Math.max(0, page.total - 1) };
}

/** Сколько заметок есть на сервере, но не показано. */
export function hiddenCount(page: TherapistNotesPage): number {
  return Math.max(0, page.total - page.notes.length);
}

/** Строка о срезе или null, если показано всё. Безличная: обращения и рода нет. */
export function notesHint(page: TherapistNotesPage): string | null {
  if (hiddenCount(page) === 0) return null;
  return `Показаны последние ${page.notes.length} из ${page.total}. Более ранние заметки сохранены, но здесь не выводятся.`;
}
