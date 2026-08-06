// Строка быстрого действия: эмодзи + название + подпись. Перенесена из
// FloatingPill (была DiaryTypeButton) — единственная копия (правило «одна
// механика — один компонент»), добавлена только иконка.
export function ActionRow({
  emoji,
  label,
  sub,
  onClick,
}: {
  emoji: string;
  label: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        minHeight: 60,
        padding: '14px 16px',
        borderRadius: 16,
        border: '1px solid var(--line)',
        background: 'var(--surface)',
        cursor: 'pointer',
        fontFamily: 'inherit',
        textAlign: 'left',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <span style={{ fontSize: 22, flexShrink: 0 }}>{emoji}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>
          {label}
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 3 }}>
          {sub}
        </div>
      </div>
    </button>
  );
}
