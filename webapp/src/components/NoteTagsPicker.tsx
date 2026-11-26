// Темы дня в заметке к дню — чипы SignChip под полем (раскладка быстрой записи): выбранная
// тема — бумага заметки (ENTITY_LOOK.note) с галочкой, а не цветная обводка. Список тем —
// shared/src/notes/noteTags.ts: его же подписи показывает история дня.
import { ENTITY_LOOK } from '../../../shared/src/theme/entityLook';
import { NOTE_TAGS } from '../../../shared/src/notes/noteTags';
import { SignChip } from './paper/SignChip';
import '../styles/sheet-diary.css';

interface Props {
  selectedTags: Set<string>;
  onToggle: (id: string) => void;
}

export function NoteTagsPicker({ selectedTags, onToggle }: Props) {
  return (
    <div className="sd-note-tags" role="group" aria-labelledby="sd-note-tags-label">
      <div className="ds-label" id="sd-note-tags-label">Темы дня</div>
      <div className="sd-note-chips">
        {NOTE_TAGS.map(t => (
          <SignChip key={t.id} label={t.label} on={selectedTags.has(t.id)} onToggle={() => onToggle(t.id)} hue={ENTITY_LOOK.note.hue} />
        ))}
      </div>
    </div>
  );
}
