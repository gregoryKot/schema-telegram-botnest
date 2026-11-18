import type { CSSProperties } from 'react';
import '../../styles/therapist-tabs.css';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
import { todayStr } from '../../utils/format';
import type { ClientDetail } from './clientSheetTypes';
import { LimitedTextarea } from '../../../../shared/src/components/LimitedTextarea';
import { SESSION_NOTE_MAX } from '../../../../shared/src/limits/textLimits';
import { SignHead } from './SignArt';
import { SessionArchive } from './SessionArchive';
import { SessionWorkBlock } from './SessionWorkBlock';
import { hasCustomMode, useCustomModeNames } from './useCustomModeNames';

interface Props {
  detail: ClientDetail;
  /** Вкладку открыли строкой журнала «На сессиях»: id записи, которую показать (один раз). */
  takeFocus?: () => number | null;
}

export function ClientSessionsTab({ detail, takeFocus }: Props) {
  const { newNoteDate, setNewNoteDate, newNoteText, setNewNoteText, addNote, noteSaving, noteError, notesPage, removeNote } = detail;
  const canSave = (!!newNoteText.trim() || detail.newNoteWork.length > 0) && !noteSaving; // с пунктами «Что делали» текст не обязателен
  // Свои режимы нужны выбору в открытом пункте и подписям записей, где они отмечены.
  const customModes = useCustomModeNames(detail.newNoteWork.length > 0 || notesPage.notes.some(n => hasCustomMode(n.work)));
  const save = () => { if (canSave) void addNote(); }; // addNote ловит сбой сам: noteError над списком
  return (
    <div className="ds-page tb-page--narrow">
      <div className="pp-leaf tb-composer" style={{ '--h': ENTITY_LOOK.note.hue } as CSSProperties}>
        <div className="tb-composer-head">
          <SignHead kind="pebbles" as="div" className="ds-h3">Новая заметка</SignHead>
          <input type="date" lang="ru" className="ds-input ds-input--sm" aria-label="Дата заметки" value={newNoteDate || todayStr()} onChange={e => setNewNoteDate(e.target.value)} />
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
        <SessionWorkBlock detail={detail} customModes={customModes} />
        <div className="tb-composer-foot">
          <span className="tb-hint kbd-hint">⌘ + Enter — сохранить</span>
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

      <SessionArchive page={notesPage} removeNote={removeNote} takeFocus={takeFocus} customModes={customModes} />
    </div>
  );
}
