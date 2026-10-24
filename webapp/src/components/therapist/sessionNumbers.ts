import type { TherapistNote } from '../../api';
import { compareNotesAsc } from '../../../../shared/src/therapy/notesPage';

/** Номер сессии каждой заметки (порядок — compareNotesAsc). `total` — сколько заметок на сервере: показаны только последние, ранние номера заняты скрытыми. */
export function sessionNumbers(notes: Pick<TherapistNote, 'id' | 'date' | 'createdAt'>[], total = notes.length): Map<number, number> {
  const offset = Math.max(0, total - notes.length);
  return new Map(notes.slice().sort(compareNotesAsc).map((n, i) => [n.id, offset + i + 1]));
}
