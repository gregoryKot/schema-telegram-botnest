import { fmtDate } from '../../utils/format';
import { pressable } from '../../utils/a11y';
import { DIARY_HUE, hueStyle } from '../../lib/tone';
import type { NoteItem } from './notesModel';

export function NoteCard({ item, expanded, onToggle }: { item: NoteItem; expanded: boolean; onToggle: () => void }) {
  return (
    <div className="ds-card ds-card--row ds-card--hover tb-note" aria-expanded={expanded} {...pressable(onToggle)}>
      <div className="tb-note-head">
        <span className="ds-chip ds-chip--sm tone-tint tb-nowrap" style={hueStyle(DIARY_HUE[item.kind])}>{item.typeLabel}</span>
        <span className="tb-note-title">{item.title}</span>
        {item.date && <span className="tb-meta tb-nowrap">{fmtDate(item.date)}</span>}
      </div>
      {item.excerpt && <div className={`tb-note-text${expanded ? '' : ' is-clamped'}`}>{item.excerpt}</div>}
      {expanded && item.fields.length > 0 && (
        <div className="tb-fields">
          {item.fields.map(f => (
            <div key={f.label}>
              <div className="ds-label tb-field-label">{f.label}</div>
              <div className="tb-field-val">{f.val}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
