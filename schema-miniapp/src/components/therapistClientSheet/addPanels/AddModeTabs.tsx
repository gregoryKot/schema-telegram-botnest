import { AddMode } from '../../therapist/useAddClient';

// Переключатель способа добавления клиента (ссылка / Telegram ID / оффлайн).
// Вынесено из ClientListView.tsx (правило №10).
export function AddModeTabs({
  addMode,
  onPick,
}: {
  addMode: AddMode | null;
  onPick: (mode: AddMode) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
      {(
        [
          ['invite', 'Ссылка'],
          ['telegram', 'Telegram ID'],
          ['virtual', 'Оффлайн'],
        ] as [AddMode, string][]
      ).map(([mode, label]) => (
        <button
          key={mode}
          onClick={() => onPick(mode)}
          style={{
            flex: 1,
            padding: '9px 4px',
            borderRadius: 'var(--r-12)',
            border: 'none',
            background:
              addMode === mode
                ? 'color-mix(in srgb, var(--accent) 20%, transparent)'
                : 'rgba(var(--fg-rgb),0.05)',
            color:
              addMode === mode ? 'var(--accent)' : 'rgba(var(--fg-rgb),0.4)',
            fontSize: 12,
            fontWeight: addMode === mode ? 600 : 400,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
