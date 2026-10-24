// Вынесено из NoteSheet.tsx (правило №10 CLAUDE.md — файл-храповик): чипы тем
// дня — самостоятельный кусок разметки, без изменения поведения.
import { DIARY_HUE, hueStyle } from '../lib/tone';
import '../styles/sheet-diary.css';

const TAGS = [
  { id: 'work',       label: 'Работа' },
  { id: 'relations',  label: 'Отношения' },
  { id: 'health',     label: 'Здоровье' },
  { id: 'loneliness', label: 'Одиночество' },
  { id: 'rest',       label: 'Отдых' },
  { id: 'family',     label: 'Семья' },
  { id: 'creativity', label: 'Творчество' },
  { id: 'anxiety',    label: 'Тревога' },
  { id: 'joy',        label: 'Радость' },
  { id: 'body',       label: 'Тело' },
];

interface Props {
  selectedTags: Set<string>;
  onToggle: (id: string) => void;
}

export function NoteTagsPicker({ selectedTags, onToggle }: Props) {
  return (
    <div className="ds-card sd-note-field" style={hueStyle(DIARY_HUE.schema)}>
      <div className="ds-label">Темы дня</div>
      <div className="sd-chips">
        {TAGS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => onToggle(t.id)}
            aria-pressed={selectedTags.has(t.id)}
            className={'ds-chip sd-chip' + (selectedTags.has(t.id) ? ' is-selected tone-tint' : '')}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
