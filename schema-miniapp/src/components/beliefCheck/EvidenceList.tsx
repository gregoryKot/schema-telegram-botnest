import { pressable } from '../../utils/a11y';
import { CrisisGate } from '../CrisisGate';

// Список доказательств (за/против) в проверке убеждения: строки с
// удалением + поле добавления + кризисный гейт. Общий для обеих сторон —
// вынесено из BeliefCheck.tsx (правило №10, дедуп for/against).
export function EvidenceList({
  items,
  setItems,
  input,
  setInput,
  onAdd,
  accentColor,
  surface,
}: {
  items: string[];
  setItems: React.Dispatch<React.SetStateAction<string[]>>;
  input: string;
  setInput: (v: string) => void;
  onAdd: () => void;
  accentColor: string;
  surface: string;
}) {
  return (
    <>
      {items.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          {items.map((f, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '7px 0',
                borderBottom: '1px solid rgba(var(--fg-rgb),0.05)',
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--text-sub)',
                  flex: 1,
                }}
              >
                • {f}
              </span>
              <span
                {...pressable(() =>
                  setItems((l) => l.filter((_, j) => j !== i)),
                )}
                style={{
                  fontSize: 16,
                  color: 'var(--text-faint)',
                  cursor: 'pointer',
                  padding: '0 4px',
                }}
              >
                ×
              </span>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onAdd()}
          placeholder="Добавить..."
          style={{
            flex: 1,
            background: 'rgba(var(--fg-rgb),0.04)',
            border: '1px solid rgba(var(--fg-rgb),0.1)',
            borderRadius: 10,
            padding: '10px 12px',
            color: 'var(--text)',
            fontSize: 14,
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />
        <button
          onClick={onAdd}
          style={{
            padding: '10px 14px',
            borderRadius: 10,
            border: 'none',
            background: `color-mix(in srgb, ${accentColor} 15%, transparent)`,
            color: accentColor,
            fontSize: 16,
            cursor: 'pointer',
          }}
        >
          +
        </button>
      </div>
      <CrisisGate texts={[input, ...items]} surface={surface} />
    </>
  );
}
