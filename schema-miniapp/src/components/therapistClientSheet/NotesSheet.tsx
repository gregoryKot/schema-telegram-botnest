import { BottomSheet } from '../BottomSheet';
import { fmtDate } from '../../utils/format';
import type { ClientDetail } from './types';

interface Props {
  detail: ClientDetail;
}

export function NotesSheet({ detail }: Props) {
  const {
    setShowNotesSheet,
    notes,
    removeNote,
    newNoteText,
    setNewNoteText,
    setNoteError,
    noteError,
    addNote,
    noteSaving,
  } = detail;

  return (
    <BottomSheet onClose={() => setShowNotesSheet(false)}>
      <div style={{ paddingTop: 4 }}>
        <div
          style={{
            fontSize: 17,
            fontWeight: 700,
            color: 'var(--text)',
            marginBottom: 16,
          }}
        >
          📝 Заметки сессий
        </div>
        {notes.length === 0 ? (
          <div
            style={{
              color: 'var(--text-faint)',
              fontSize: 13,
              textAlign: 'center',
              padding: '20px 0 16px',
            }}
          >
            Нет заметок. Добавь первую ниже.
          </div>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              style={{
                background: 'rgba(var(--fg-rgb),0.03)',
                border: '1px solid rgba(var(--fg-rgb),0.06)',
                borderRadius: 14,
                padding: '12px 14px',
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: 6,
                }}
              >
                <span style={{ fontSize: 11, color: 'var(--text-sub)' }}>
                  {fmtDate(note.date)}
                </span>
                <button
                  onClick={() => removeNote(note.id)}
                  aria-label="Удалить заметку"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent-red)',
                    fontSize: 18,
                    cursor: 'pointer',
                    padding: '0 2px',
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: 'rgba(var(--fg-rgb),0.75)',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {note.text}
              </div>
            </div>
          ))
        )}
        <div
          style={{
            background: 'rgba(var(--fg-rgb),0.03)',
            border: '1px solid rgba(var(--fg-rgb),0.07)',
            borderRadius: 16,
            padding: 14,
            marginTop: 8,
          }}
        >
          <textarea
            value={newNoteText}
            onChange={(e) => {
              setNewNoteText(e.target.value);
              setNoteError('');
            }}
            placeholder="Заметка сессии: наблюдения, гипотезы, динамика, план следующей встречи..."
            rows={3}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              resize: 'none',
              color: 'var(--text)',
              fontSize: 13,
              lineHeight: 1.5,
              fontFamily: 'inherit',
            }}
          />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 8,
            }}
          >
            {noteError ? (
              <div style={{ fontSize: 12, color: 'var(--accent-red)' }}>
                {noteError}
              </div>
            ) : (
              <div />
            )}
            <button
              onClick={addNote}
              disabled={noteSaving || !newNoteText.trim()}
              style={{
                padding: '8px 18px',
                borderRadius: 10,
                border: 'none',
                background: newNoteText.trim()
                  ? 'color-mix(in srgb, var(--accent) 25%, transparent)'
                  : 'rgba(var(--fg-rgb),0.06)',
                color: newNoteText.trim()
                  ? 'var(--accent)'
                  : 'rgba(var(--fg-rgb),0.25)',
                fontSize: 13,
                fontWeight: 600,
                cursor: newNoteText.trim() ? 'pointer' : 'default',
                opacity: noteSaving ? 0.6 : 1,
              }}
            >
              {noteSaving ? 'Сохраняю...' : 'Добавить заметку'}
            </button>
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}
