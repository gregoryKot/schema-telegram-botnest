// Чип-кнопка визитки: день/время слота, канал связи, валюта (одна механика — один компонент).
export function Chip({ active, onClick, children, style }: { active: boolean; onClick: () => void; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} style={{
      padding: '9px 16px', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
      borderRadius: 100, whiteSpace: 'nowrap', transition: 'all .15s',
      background: active ? 'var(--accent)' : 'transparent',
      color: active ? 'var(--on-accent)' : 'var(--text-sub)',
      border: `1.5px solid ${active ? 'var(--accent)' : 'var(--line-strong)'}`, ...style,
    }}>{children}</button>
  );
}
