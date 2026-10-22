import { notesHint, type TherapistNotesPage } from './notesPage';

/** Подпись над списком заметок, когда сервер отдал не все (признак «есть ещё»). */
export function NotesTruncationHint({ page }: { page: TherapistNotesPage }) {
  const text = notesHint(page);
  if (!text) return null;
  return (
    <div
      role="note"
      style={{ color: 'var(--text-faint)', fontSize: 12, margin: '0 0 10px' }}
    >
      {text}
    </div>
  );
}
