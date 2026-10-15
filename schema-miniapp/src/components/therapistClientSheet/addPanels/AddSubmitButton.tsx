// Кнопка «Создать» панели добавления клиента: активна, когда поле заполнено;
// акцентная заливка — у главного действия. Вынесено из AddInputPanel.tsx
// (правило №10 — файл-храповик).
export function AddSubmitButton({
  onClick,
  disabled,
  filled,
  accent,
  label,
}: {
  onClick: () => void;
  disabled: boolean;
  filled: boolean;
  accent: boolean;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '9px 16px',
        borderRadius: 'var(--r-10)',
        border: 'none',
        background: filled
          ? accent
            ? 'var(--accent)'
            : 'rgba(var(--fg-rgb),0.12)'
          : 'rgba(var(--fg-rgb),0.05)',
        color: filled
          ? accent
            ? '#fff'
            : 'var(--text)'
          : 'rgba(var(--fg-rgb),0.3)',
        fontSize: 13,
        fontWeight: 600,
        cursor: filled ? 'pointer' : 'default',
        flexShrink: 0,
      }}
    >
      {label}
    </button>
  );
}
