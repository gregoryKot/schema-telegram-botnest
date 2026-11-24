import { useEffect, useRef, useState } from 'react';
import { fmtDate } from '../../utils/format';
import { sessionNumbers } from './sessionNumbers';
import { HistoryConfirmDialog } from '../HistoryConfirmDialog';
import { pluralRu } from '../../../../shared/src/utils/pluralRu';
import { NotesTruncationHint } from '../../../../shared/src/therapy/NotesTruncationHint';
import type { TherapistNotesPage } from '../../../../shared/src/therapy/notesPage';
import { Sign } from './SignArt';
import { SessionNoteRow } from './SessionNoteRow'; import { useSessionPlanTitles } from './useSessionPlanTitles';
import { EarlySessionNote } from './EarlySessionNote';
import type { UserId } from '../../../../shared/src/userId';
import type { NamedMode } from './useCustomModeNames';

// Архив заметок сессий. Удаление — через подтверждение: до 2026-10-26 заметку
// стирал один клик по «✕» рядом с датой (QA-проход), вернуть её было нельзя.
export function SessionArchive({ page, removeNote, takeFocus, customModes, clientId }: {
  /** true — заметка удалена. */
  page: TherapistNotesPage; removeNote: (id: number) => boolean | Promise<boolean>;
  /** Запись, к которой пришли из журнала «На сессиях»: прокручивается в вид и подсвечена. */
  takeFocus?: () => number | null;
  customModes?: NamedMode[];
  /** Клиент — чтобы догрузить запись из журнала, которой нет среди показанных. */
  clientId?: UserId;
}) {
  const [focusId, setFocusId] = useState(() => takeFocus?.() ?? null);
  const focusRef = useRef<HTMLDivElement>(null);
  useEffect(() => { focusRef.current?.scrollIntoView?.({ block: 'center' }); }, []);
  const { notes, total } = page; const planTitles = useSessionPlanTitles(clientId, notes);
  const numbers = sessionNumbers(notes, total);
  const early = focusId !== null && clientId != null && !notes.some(n => n.id === focusId);
  // Одно подтверждение на показанные записи и на раннюю (её в `notes` нет — номер приходит с ней).
  const [confirmNote, setConfirmNote] = useState<{ id: number; date: string; number?: number } | null>(null);
  const [busy, setBusy] = useState(false);
  // Диалог закрывается и после ошибки удаления: её показывает вызывающий код.
  const remove = async (id: number) => {
    setBusy(true);
    // Удалённая ранняя запись уходит с экрана: в `notes` её нет, убрать её может только архив.
    try { if (await removeNote(id) === true && early && id === focusId) setFocusId(null); } finally { setBusy(false); }
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
            onDelete={() => setConfirmNote({ id: note.id, date: note.date, number: numbers.get(note.id) })} customModes={customModes} planTitles={planTitles}
          />
        ))
      )}
      {early && <EarlySessionNote clientId={clientId} noteId={focusId} onDelete={f => setConfirmNote({ id: f.note.id, date: f.note.date, number: f.number })} />}
      {confirmNote && (
        <HistoryConfirmDialog
          title="Удалить заметку?"
          message={`Заметка о сессии ${confirmNote.number ?? ''} от ${fmtDate(confirmNote.date)} удалится насовсем.`}
          confirmLabel="Удалить"
          busyLabel="Удаляю…"
          busy={busy}
          run={() => remove(confirmNote.id)}
          onCancel={() => setConfirmNote(null)}
        />
      )}
    </div>
  );
}
