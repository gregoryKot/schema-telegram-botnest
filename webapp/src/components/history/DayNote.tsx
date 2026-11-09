// Заметка дня в истории: листок бумаги заметки (ENTITY_LOOK.note, солома + Pebbles), текст в две
// строки и темы дня подписями из общего списка (shared/src/notes/noteTags.ts) — не сырыми id.
import type { CSSProperties } from 'react';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
import { noteTagLabels } from '../../../../shared/src/notes/noteTags';
import { Pebbles } from '../art/PaperArt';
import { pressable } from '../../utils/a11y';

export function DayNote({ text, tags, onOpen }: { text: string | null; tags: string[]; onOpen: () => void }) {
  const labels = noteTagLabels(tags);
  return (
    <div className="pp-paper sd-note" style={{ '--h': ENTITY_LOOK.note.hue } as CSSProperties} {...pressable(onOpen)}>
      <span className="sd-note-sign" aria-hidden="true"><Pebbles size="row" /></span>
      <div className="sd-note-body">
        <span className={'sd-note-text' + (text ? '' : ' is-empty')}>{text || 'Добавить заметку к этому дню'}</span>
        {labels.length > 0 && (
          <span className="sd-tags">{labels.map(t => <span key={t.id} className="sd-tag">{t.label}</span>)}</span>
        )}
      </div>
      <span className="ds-chev" aria-hidden="true" />
    </div>
  );
}
