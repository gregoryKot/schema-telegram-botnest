import { fmtDate, todayStr } from '../../utils/format';
import type { ClientDetail } from './clientSheetTypes';

interface Props {
  detail: ClientDetail;
}

export function ClientSessionsTab({ detail }: Props) {
  const {
    newNoteDate, setNewNoteDate, newNoteText, setNewNoteText,
    addNote, noteSaving, noteError, notes, removeNote,
  } = detail;

  return (
    <div className="page-inner-wide" style={{ paddingTop: 40 }}>
      {/* Composer */}
      <div style={{ marginBottom: 0 }}>
        <div className="eyebrow" style={{ marginBottom: 16 }}>
          Новая заметка · {fmtDate(newNoteDate || todayStr())}
          <input type="date" value={newNoteDate || todayStr()} onChange={e => setNewNoteDate(e.target.value)}
                 style={{ marginLeft: 10, fontSize: 11, padding: '2px 6px', border: '1px solid var(--line)', borderRadius: 4, background: 'transparent', color: 'var(--text-faint)' }} />
        </div>
        <textarea
          className="textarea"
          value={newNoteText}
          onChange={e => setNewNoteText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addNote(); }}
          rows={4}
          placeholder="Наблюдения, гипотезы, динамика, план следующей встречи…"
          style={{ fontSize: 15, lineHeight: 1.65 }}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>⌘+Enter – сохранить</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {newNoteText.trim() && (
              <button onClick={() => setNewNoteText('')} className="btn btn-secondary">Отмена</button>
            )}
            <button onClick={addNote} disabled={!newNoteText.trim() || noteSaving} className="btn btn-primary">
              {noteSaving ? '...' : 'Сохранить'}
            </button>
          </div>
        </div>
        {noteError && <div style={{ marginTop: 8, fontSize: 13, color: 'var(--c-rose)' }}>{noteError}</div>}
      </div>

      <hr className="hr-soft" style={{ margin: '48px 0' }} />

      {/* Archive */}
      <div className="eyebrow" style={{ marginBottom: 32 }}>Архив · {notes.length} заметок</div>
      {notes.length === 0 ? (
        <div style={{ color: 'var(--text-faint)', fontSize: 14 }}>Заметок пока нет</div>
      ) : (
        notes.map((note, i) => (
          <div key={note.id} style={{ marginBottom: 48 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{fmtDate(note.date)}</span>
                <span style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>Сессия {notes.length - i}</span>
              </div>
              <button onClick={() => removeNote(note.id)} aria-label="Удалить заметку" style={{ background: 'none', border: 'none', padding: '2px 6px', borderRadius: 4, fontSize: 12, color: 'var(--text-ghost)', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--text-sub)', maxWidth: 720, whiteSpace: 'pre-wrap' }}>
              {note.text}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
