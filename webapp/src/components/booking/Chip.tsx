// Чип-кнопка визитки: день/время слота и канал связи (одна механика — один компонент).
export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} style={{
      padding: '9px 16px', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
      borderRadius: 100, whiteSpace: 'nowrap', transition: 'all .15s',
      background: active ? 'var(--accent)' : 'transparent',
      color: active ? '#fff' : 'var(--text-sub)',
      border: `1.5px solid ${active ? 'var(--accent)' : 'var(--line-strong)'}`,
    }}>{children}</button>
  );
}
