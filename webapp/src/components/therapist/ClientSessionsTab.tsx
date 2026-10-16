import '../../styles/therapist-tabs.css';
import { todayStr } from '../../utils/format';
import type { ClientDetail } from './clientSheetTypes';
import { LimitedTextarea } from '../../../../shared/src/components/LimitedTextarea';
import { SESSION_NOTE_MAX } from '../../../../shared/src/limits/textLimits';
import { SessionArchive } from './SessionArchive';

interface Props {
  detail: ClientDetail;
}

export function ClientSessionsTab({ detail }: Props) {
  const { newNoteDate, setNewNoteDate, newNoteText, setNewNoteText, addNote, noteSaving, noteError, notes, removeNote } = detail;
  const canSave = !!newNoteText.trim() && !noteSaving;
  const save = () => { if (canSave) addNote(); };

  return (
    <div className="ds-page tb-page tb-page--narrow">
      <div className="ds-card tb-composer">
        <div className="tb-composer-head">
          <div className="ds-h3">Новая заметка</div>
          <input type="date" className="tb-date-pill" aria-label="Дата заметки" value={newNoteDate || todayStr()} onChange={e => setNewNoteDate(e.target.value)} />
        </div>
        <LimitedTextarea
          max={SESSION_NOTE_MAX}
          className="ds-textarea tb-composer-area"
          value={newNoteText}
          onChange={e => setNewNoteText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save(); } }}
          rows={5}
          placeholder="Наблюдения, гипотезы, динамика, план следующей встречи…"
        />
        <div className="tb-composer-foot">
          <span className="tb-hint">⌘ + Enter — сохранить</span>
          <div className="tb-actions">
            {newNoteText.trim() && (
              <button onClick={() => setNewNoteText('')} className="ds-btn ds-btn--sm ds-btn--secondary">Отмена</button>
            )}
            <button onClick={save} disabled={!canSave} className="ds-btn ds-btn--sm">
              {noteSaving ? '...' : 'Сохранить'}
            </button>
          </div>
        </div>
        {noteError && <div className="tb-error">{noteError}</div>}
      </div>

      <SessionArchive notes={notes} removeNote={removeNote} />
    </div>
  );
}
