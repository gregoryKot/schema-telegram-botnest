import { fmtDate } from '../../utils/format';
import type { ClientDetail } from './types';

type Note = ClientDetail['notes'][number];

/** Карточка одной заметки сессии: дата, удалить, текст. */
export function NoteCard({
  note,
  onRemove,
}: {
  note: Note;
  onRemove: (id: number) => void;
}) {
  return (
    <div
      style={{
        background: 'rgba(var(--fg-rgb),0.03)',
        border: '1px solid rgba(var(--fg-rgb),0.06)',
        borderRadius: 'var(--r-14)',
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
          onClick={() => onRemove(note.id)}
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
  );
}
