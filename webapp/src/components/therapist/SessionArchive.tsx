import { fmtDate } from '../../utils/format';
import { sessionNumbers } from './sessionNumbers';
import { NotesTruncationHint } from '../../../../shared/src/therapy/NotesTruncationHint';
import type { TherapistNotesPage } from '../../../../shared/src/therapy/notesPage';

export function SessionArchive({ page, removeNote }: { page: TherapistNotesPage; removeNote: (id: number) => void }) {
  const { notes, total } = page;
  const numbers = sessionNumbers(notes, total);
  return (
    <div>
      <div className="ds-label tb-archive-label">Архив · {total} заметок</div>
      <NotesTruncationHint page={page} />
      {notes.length === 0 ? (
        <div className="tb-empty">Заметок пока нет</div>
      ) : (
        notes.map(note => (
          <div key={note.id} className="tb-tl-row">
            <div className="tb-tl-rail">
              <div className="tb-tl-dot">{numbers.get(note.id)}</div>
              <div className="tb-tl-line" />
            </div>
            <div className="tb-tl-body">
              <div className="tb-tl-head">
                <span className="tb-tl-date">{fmtDate(note.date)}</span>
                <span className="tb-meta">Сессия {numbers.get(note.id)}</span>
                <button onClick={() => removeNote(note.id)} aria-label="Удалить заметку" className="tb-x">✕</button>
              </div>
              <div className="tb-tl-text">{note.text}</div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
