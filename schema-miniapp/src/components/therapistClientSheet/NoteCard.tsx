import { fmtDate } from '../../utils/format';
import type { ClientDetail } from './types';
import { ConfirmDeleteButton } from '../ConfirmDeleteButton';

type Note = ClientDetail['notes'][number];

/**
 * Карточка одной заметки сессии: дата, удалить, текст. Удаление — в два тапа
 * (QA 2026-10-26: заметку стирал один тап по «×»).
 */
export function NoteCard({
  note,
  pending,
  onTapDelete,
}: {
  note: Note;
  /** Первый тап по «×» уже был — ждём подтверждения. */
  pending: boolean;
  onTapDelete: () => void;
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
        <ConfirmDeleteButton
          pending={pending}
          onTap={onTapDelete}
          label="Удалить заметку"
        />
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
