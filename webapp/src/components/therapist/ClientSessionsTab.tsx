import type { TherapistNote } from '../../api';
import { fmtDate, todayStr } from '../../utils/format';

interface Props {
  notes: TherapistNote[];
  newNoteText: string;
  newNoteDate: string;
  noteSaving: boolean;
  noteError: string;
  setNewNoteText: (v: string) => void;
  setNewNoteDate: (v: string) => void;
  addNote: () => void;
  removeNote: (id: number) => void;
}

export function ClientSessionsTab({ notes, newNoteText, newNoteDate, noteSaving, noteError, setNewNoteText, setNewNoteDate, addNote, removeNote }: Props) {
  return (
    <div className="page-inner" style={{ paddingTop: 40 }}>
      <div className="sessions-grid">
        {/* Notes timeline */}
        <div>
          {notes.length === 0 ? (
            <div style={{ padding: '64px 0', color: 'var(--text-faint)', fontSize: 14, textAlign: 'center' }}>
              Заметок ещё нет. Добавь первую справа.
            </div>
          ) : (
            <div style={{ position: 'relative', paddingLeft: 28 }}>
              <div style={{ position: 'absolute', left: 7, top: 8, bottom: 8, width: 2, background: 'var(--line)', borderRadius: 2 }} />
              {notes.map((note, i) => (
                <div key={note.id} style={{ position: 'relative', marginBottom: 36 }}>
                  <div style={{ position: 'absolute', left: -25, top: 4, width: 10, height: 10, borderRadius: '50%', background: 'var(--accent)', border: '2px solid var(--bg)', zIndex: 1 }} />
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{fmtDate(note.date)}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-faint)', background: 'var(--surface-3)', borderRadius: 4, padding: '1px 6px' }}>
                        Сессия {notes.length - i}
                      </span>
                    </div>
                    <button onClick={() => removeNote(note.id)} style={{ background: 'none', border: 'none', padding: '2px 6px', borderRadius: 4, fontSize: 12, color: 'var(--text-ghost)', cursor: 'pointer' }} title="Удалить">✕</button>
                  </div>
                  <div style={{ fontSize: 14, lineHeight: 1.75, color: 'var(--text-sub)', whiteSpace: 'pre-wrap' }}>{note.text}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sticky composer */}
        <div style={{ position: 'sticky', top: 24 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Новая заметка</div>
          <div style={{ marginBottom: 10 }}>
            <input
              type="date"
              value={newNoteDate || todayStr()}
              onChange={e => setNewNoteDate(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg)', fontSize: 13, color: 'var(--text)', boxSizing: 'border-box' }}
            />
          </div>
          <textarea
            className="textarea"
            value={newNoteText}
            onChange={e => setNewNoteText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addNote(); }}
            rows={6}
            placeholder="Наблюдения, гипотезы, динамика, план следующей встречи…"
            style={{ fontSize: 13, lineHeight: 1.65 }}
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
            <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>⌘+Enter</span>
            <button onClick={addNote} disabled={!newNoteText.trim() || noteSaving} style={{ padding: '7px 16px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: 'var(--on-accent)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              {noteSaving ? '...' : 'Сохранить'}
            </button>
          </div>
          {noteError && <div style={{ marginTop: 8, fontSize: 12, color: 'var(--c-rose)' }}>{noteError}</div>}
        </div>
      </div>
    </div>
  );
}
