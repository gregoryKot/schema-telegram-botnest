import { useEffect, useRef, useState } from 'react';
import { fmtDate } from '../../utils/format';
import { sessionNumbers } from './sessionNumbers';
import { HistoryConfirmDialog } from '../HistoryConfirmDialog';
import { pluralRu } from '../../../../shared/src/utils/pluralRu';
import { NotesTruncationHint } from '../../../../shared/src/therapy/NotesTruncationHint';
import type { TherapistNotesPage } from '../../../../shared/src/therapy/notesPage';
import { Sign } from './SignArt';
import { SessionNoteRow } from './SessionNoteRow';
import { EarlySessionNote } from './EarlySessionNote';
import type { UserId } from '../../../../shared/src/userId';
import type { NamedMode } from './useCustomModeNames';

// Архив заметок сессий. Удаление — через подтверждение: до 2026-10-26 заметку
// стирал один клик по «✕» рядом с датой (QA-проход), вернуть её было нельзя.
export function SessionArchive({ page, removeNote, takeFocus, customModes, clientId }: {
  page: TherapistNotesPage; removeNote: (id: number) => void | Promise<void>;
  /** Запись, к которой пришли из журнала «На сессиях»: прокручивается в вид и подсвечена. */
  takeFocus?: () => number | null;
  customModes?: NamedMode[];
  /** Клиент — чтобы догрузить запись из журнала, которой нет среди показанных. */
  clientId?: UserId;
}) {
  const [focusId] = useState(() => takeFocus?.() ?? null);
  const focusRef = useRef<HTMLDivElement>(null);
  useEffect(() => { focusRef.current?.scrollIntoView?.({ block: 'center' }); }, []);
  const { notes, total } = page;
  const numbers = sessionNumbers(notes, total);
  const early = focusId !== null && clientId != null && !notes.some(n => n.id === focusId);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const confirmNote = notes.find(n => n.id === confirmId);
  // Диалог закрывается и после ошибки удаления: её показывает вызывающий код.
  const remove = async (id: number) => {
    setBusy(true);
    try { await removeNote(id); } finally { setBusy(false); }
    return true;
  };
  return (
    <div>
      <div className="ds-label tb-archive-label">Архив · {total} {pluralRu(total, 'заметка', 'заметки', 'заметок')}</div>
      <NotesTruncationHint page={page} />
      {notes.length === 0 ? (
        // Пусто — тихо: знак строкой и текст; знак — Pebbles, как у формы и «Заметки сессии» на «Обзоре» (r1).
        <p className="ds-empty tb-empty-row"><Sign kind="pebbles" />Заметок пока нет</p>
      ) : (
        notes.map(note => (
          <SessionNoteRow
            key={note.id} note={note} number={numbers.get(note.id)} focus={note.id === focusId} rowRef={note.id === focusId ? focusRef : undefined}
            onDelete={() => setConfirmId(note.id)} customModes={customModes}
          />
        ))
      )}
      {early && <EarlySessionNote clientId={clientId} noteId={focusId} />}
      {confirmNote && (
        <HistoryConfirmDialog
          title="Удалить заметку?"
          message={`Заметка о сессии ${numbers.get(confirmNote.id) ?? ''} от ${fmtDate(confirmNote.date)} удалится насовсем.`}
          confirmLabel="Удалить"
          busyLabel="Удаляю…"
          busy={busy}
          run={() => remove(confirmNote.id)}
          onCancel={() => setConfirmId(null)}
        />
      )}
    </div>
  );
}
