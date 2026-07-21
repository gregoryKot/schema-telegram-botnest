// Вынесено из NoteSheet.tsx (правило №10 CLAUDE.md — файл-храповик): чипы тем
// дня — самостоятельный кусок разметки, без изменения поведения.
const TAGS = [
  { id: 'work',       label: 'Работа',      emoji: '💼' },
  { id: 'relations',  label: 'Отношения',   emoji: '🤝' },
  { id: 'health',     label: 'Здоровье',    emoji: '🏃' },
  { id: 'loneliness', label: 'Одиночество', emoji: '🌙' },
  { id: 'rest',       label: 'Отдых',       emoji: '🛋️' },
  { id: 'family',     label: 'Семья',       emoji: '🏠' },
  { id: 'creativity', label: 'Творчество',  emoji: '🎨' },
  { id: 'anxiety',    label: 'Тревога',     emoji: '😰' },
  { id: 'joy',        label: 'Радость',     emoji: '✨' },
  { id: 'body',       label: 'Тело',        emoji: '💆' },
];

interface Props {
  selectedTags: Set<string>;
  onToggle: (id: string) => void;
}

export function NoteTagsPicker({ selectedTags, onToggle }: Props) {
  return (
    <div className="prompt">
      <div className="prompt-num">·</div>
      <div style={{ width: '100%' }}>
        <div className="prompt-label">Темы дня</div>
        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {TAGS.map(t => {
            const on = selectedTags.has(t.id);
            return (
              <div
                key={t.id}
                onClick={() => onToggle(t.id)}
                role="button" tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(t.id); } }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '7px 14px', borderRadius: 20, cursor: 'pointer',
                  background: on
                    ? 'color-mix(in srgb, var(--accent) 15%, transparent)'
                    : 'rgba(var(--fg-rgb),0.05)',
                  border: `1px solid ${on
                    ? 'color-mix(in srgb, var(--accent) 40%, transparent)'
                    : 'rgba(var(--fg-rgb),0.07)'}`,
                  color: on ? 'var(--accent)' : 'var(--text-faint)',
                  fontSize: 13, fontWeight: on ? 600 : 400,
                  transition: 'all 0.15s',
                }}
              >
                <span>{t.emoji}</span>
                <span>{t.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
