import type { Ref } from 'react';
import type { TherapistNote } from '../../api';
import { fmtDate } from '../../utils/format';
import { MMIcon } from '../modeMapIcons';
import { SessionNoteExtras } from './SessionNoteExtras';
import type { NamedMode } from './useCustomModeNames';

interface Props {
  note: TherapistNote;
  /** «Сессия N»; пока номер неизвестен — строки с ним нет. */
  number?: number;
  /** Запись, к которой пришли из журнала «На сессиях»: подсвечена. */
  focus?: boolean;
  rowRef?: Ref<HTMLDivElement>;
  onDelete?: () => void;
  customModes?: NamedMode[]; planTitles?: ReadonlyMap<number, string>;
}

/** Строка архива заметок: номер сессии на рейке, дата, текст и «Что делали». */
export function SessionNoteRow({ note, number, focus, rowRef, onDelete, customModes, planTitles }: Props) {
  return (
    <div ref={rowRef} className={focus ? 'tb-tl-row tb-tl-row--focus' : 'tb-tl-row'}>
      <div className="tb-tl-rail"><div className="tb-tl-dot">{number}</div><div className="tb-tl-line" /></div>
      <div className="tb-tl-body">
        <div className="tb-tl-head">
          <span className="tb-tl-date">{fmtDate(note.date)}</span>
          {number !== undefined && <span className="tb-meta">Сессия {number}</span>}
          {onDelete && <button type="button" onClick={onDelete} aria-label="Удалить заметку" className="ds-btn ds-btn--icon tb-del tb-tl-del"><MMIcon name="trash" size={16} /></button>}
        </div>
        {note.text && <div className="tb-tl-text">{note.text}</div>}
        <SessionNoteExtras note={note} customModes={customModes} planTitles={planTitles} />
      </div>
    </div>
  );
}
