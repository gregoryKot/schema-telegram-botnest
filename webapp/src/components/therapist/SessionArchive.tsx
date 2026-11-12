import { useState } from 'react';
import { fmtDate } from '../../utils/format';
import { MMIcon } from '../modeMapIcons';
import { sessionNumbers } from './sessionNumbers';
import { HistoryConfirmDialog } from '../HistoryConfirmDialog';
import { pluralRu } from '../../../../shared/src/utils/pluralRu';
import { NotesTruncationHint } from '../../../../shared/src/therapy/NotesTruncationHint';
import type { TherapistNotesPage } from '../../../../shared/src/therapy/notesPage';
import { Sign } from './SignArt';

// Архив заметок сессий. Удаление — через подтверждение: до 2026-10-26 заметку
// стирал один клик по «✕» рядом с датой (QA-проход), вернуть её было нельзя.
export function SessionArchive({ page, removeNote }: { page: TherapistNotesPage; removeNote: (id: number) => void | Promise<void> }) {
  const { notes, total } = page;
  const numbers = sessionNumbers(notes, total);
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
          <div key={note.id} className="tb-tl-row">
            <div className="tb-tl-rail"><div className="tb-tl-dot">{numbers.get(note.id)}</div><div className="tb-tl-line" /></div>
            <div className="tb-tl-body">
              <div className="tb-tl-head">
                <span className="tb-tl-date">{fmtDate(note.date)}</span>
                <span className="tb-meta">Сессия {numbers.get(note.id)}</span>
                <button type="button" onClick={() => setConfirmId(note.id)} aria-label="Удалить заметку" className="ds-btn ds-btn--icon tb-del tb-tl-del"><MMIcon name="trash" size={16} /></button>
              </div>
              <div className="tb-tl-text">{note.text}</div>
            </div>
          </div>
        ))
      )}
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
