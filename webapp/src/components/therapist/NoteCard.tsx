import { fmtDate } from '../../utils/format';
import { pressable } from '../../utils/a11y';
import { SignArt } from '../art/SignArt';
import { Pebbles } from '../art/PaperArt';
import { noteLook } from './noteLook';
import type { NoteItem } from './notesModel';

// Запись клиента — строка общего листа «Записей клиента», как строка «Последних записей» «Обзора» (r2): знак типа
// (noteLook), тип — тихо; своей бумаги и тени у строки нет — тень-слой у листа списка.
export function NoteCard({ item, expanded, onToggle }: { item: NoteItem; expanded: boolean; onToggle: () => void }) {
  const look = noteLook(item.kind);
  return (
    <div className="tb-note" aria-expanded={expanded} {...pressable(onToggle)}>
      <div className="tb-note-head">
        <span className="pp-row-art" aria-hidden="true">{look.filled ? <Pebbles size="row" filled={3} /> : <SignArt sign={look.sign} size="row" />}</span>
        <div className="tb-note-main">
          <span className="tb-note-title">{item.title}</span>
          <span className="tb-note-type">{item.typeLabel}</span>
        </div>
        {item.date && <span className="tb-meta tb-nowrap tb-note-date">{fmtDate(item.date)}</span>}
      </div>
      {item.excerpt && <div className={`tb-note-text${expanded ? '' : ' is-clamped'}`}>{item.excerpt}</div>}
      {expanded && item.fields.length > 0 && (
        <div className="tb-fields">
          {item.fields.map(f => (
            <div key={f.label}><div className="ds-label tb-field-label">{f.label}</div><div className="tb-field-val">{f.val}</div></div>
          ))}
        </div>
      )}
    </div>
  );
}
