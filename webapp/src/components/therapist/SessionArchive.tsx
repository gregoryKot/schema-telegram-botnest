import { fmtDate } from '../../utils/format';
import type { TherapistNote } from '../../api';
import { sessionNumbers } from './sessionNumbers';

export function SessionArchive({ notes, removeNote }: { notes: TherapistNote[]; removeNote: (id: number) => void }) {
  const numbers = sessionNumbers(notes);
  return (
    <div>
      <div className="ds-label tb-archive-label">Архив · {notes.length} заметок</div>
      {notes.length === 0 ? (
        <div className="tb-empty">Заметок пока нет</div>
      ) : (
        notes.map(note => {
          const n = numbers.get(note.id);
          return (
            <div key={note.id} className="tb-tl-row">
              <div className="tb-tl-rail">
                <div className="tb-tl-dot">{n}</div>
                <div className="tb-tl-line" />
              </div>
              <div className="tb-tl-body">
                <div className="tb-tl-head">
                  <span className="tb-tl-date">{fmtDate(note.date)}</span>
                  <span className="tb-meta">Сессия {n}</span>
                  <button onClick={() => removeNote(note.id)} aria-label="Удалить заметку" className="tb-x">✕</button>
                </div>
                <div className="tb-tl-text">{note.text}</div>
              </div>
            </div>
          );
        })
      )}
    </div>
    );
  }
