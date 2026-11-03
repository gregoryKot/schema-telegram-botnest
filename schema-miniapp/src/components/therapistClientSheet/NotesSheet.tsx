import { BottomSheet } from '../BottomSheet';
import { ClientDetail } from './types';
import { useTr } from '../../utils/addressForm';
import { LimitedTextarea } from '../../../../shared/src/components/LimitedTextarea';
import { SESSION_NOTE_MAX } from '../../../../shared/src/limits/textLimits';
import { NOTE_FIELD_STYLE } from './noteFieldStyle';
import { NoteCard } from './NoteCard';
import { useConfirmTap } from '../../hooks/useConfirmTap';
import { NotesTruncationHint } from '../../../../shared/src/therapy/NotesTruncationHint';

interface NotesSheetProps {
  detail: ClientDetail;
}

export function NotesSheet({ detail }: NotesSheetProps) {
  const tr = useTr();
  const {
    notes,
    notesPage,
    removeNote,
    newNoteText,
    setNewNoteText,
    noteError,
    setNoteError,
    noteSaving,
    addNote,
    setShowNotesSheet,
  } = detail;
  const { tap: tapDelete, isPending } = useConfirmTap<number>(
    (id) => void removeNote(id),
  );

  return (
    <BottomSheet onClose={() => setShowNotesSheet(false)}>
      <div className="u-pt4">
        <div
          style={{
            fontSize: 17,
            fontWeight: 700,
            color: 'var(--text)',
            marginBottom: 16,
          }}
        >
          Заметки сессий
        </div>
        <NotesTruncationHint page={notesPage} />
        {notes.length === 0 ? (
          <div
            style={{
              color: 'var(--text-faint)',
              fontSize: 13,
              textAlign: 'center',
              padding: '20px 0 16px',
            }}
          >
            {tr(
              'Нет заметок. Добавь первую ниже.',
              'Нет заметок. Добавьте первую ниже.',
            )}
          </div>
        ) : (
          notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              pending={isPending(note.id)}
              onTapDelete={() => tapDelete(note.id)}
            />
          ))
        )}
        <div
          style={{
            background: 'rgba(var(--fg-rgb),0.03)',
            border: '1px solid rgba(var(--fg-rgb),0.07)',
            borderRadius: 'var(--r-16)',
            padding: 14,
            marginTop: 8,
          }}
        >
          <LimitedTextarea
            max={SESSION_NOTE_MAX}
            value={newNoteText}
            onChange={(e) => {
              setNewNoteText(e.target.value);
              setNoteError('');
            }}
            placeholder="Заметка сессии: наблюдения, гипотезы, динамика, план следующей встречи..."
            rows={3}
            style={NOTE_FIELD_STYLE}
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
                borderRadius: 'var(--r-10)',
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
