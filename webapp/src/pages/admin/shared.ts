// Shared inline style objects for all admin panel sections.
export const card: React.CSSProperties = {
  background: 'var(--bg-rail)', border: '1px solid var(--line)', borderRadius: 14, padding: 20, marginBottom: 16,
};
export const btn: React.CSSProperties = {
  padding: '9px 16px', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
  background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 10,
};
export const btnGhost: React.CSSProperties = {
  ...btn, background: 'transparent', color: 'var(--text-sub)', border: '1.5px solid var(--line-strong)',
};
export const input: React.CSSProperties = {
  padding: '8px 12px', fontSize: 14, fontFamily: 'inherit', background: 'rgba(var(--fg-rgb),0.04)',
  border: '1.5px solid var(--line)', borderRadius: 8, color: 'var(--text)', outline: 'none', width: '100%',
};
