// ── Sub-components ────────────────────────────────────────────────────────────
// Презентационные примитивы SettingsSheet — вынесены из SettingsSheet.tsx
// (правило №10, файл превысил потолок 300 строк). Чистый перенос без
// переименований/рестайлинга.

export function SHead({ id, label, hint }: { id: string; label: string; hint?: string }) {
  return (
    <div id={id} style={{ paddingTop: 40, paddingBottom: 10, borderBottom: '1px solid var(--line)' }}>
      <div className="eyebrow">{label}</div>
      {hint && <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 4, lineHeight: 1.5 }}>{hint}</div>}
    </div>
  );
}

export function SRow({ title, sub, right, onClick, danger }: {
  title: string; sub?: React.ReactNode; right?: React.ReactNode;
  onClick?: () => void; danger?: boolean;
}) {
  return (
    <div onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }) : undefined}
      style={{
      display: 'flex', alignItems: 'center', gap: 16,
      padding: '13px 0',
      borderBottom: '1px solid rgba(var(--fg-rgb),0.06)',
      cursor: onClick ? 'pointer' : 'default',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, color: danger ? 'var(--accent-red)' : 'var(--text)' }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 3, lineHeight: 1.4 }}>{sub}</div>}
      </div>
      {right ?? (onClick && <span style={{ color: 'var(--text-faint)', fontSize: 16, flexShrink: 0 }}>›</span>)}
    </div>
  );
}

export function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <div onClick={onClick} role="switch" aria-checked={on} tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      style={{ width: 44, height: 26, borderRadius: 13, flexShrink: 0, background: on ? 'var(--accent)' : 'rgba(var(--fg-rgb),0.12)', position: 'relative', transition: 'background 0.2s', cursor: 'pointer' }}>
      <div style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: 'var(--bg)', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }} />
    </div>
  );
}

export function SmallToggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <div onClick={onClick} role="switch" aria-checked={on} tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      style={{ width: 38, height: 22, borderRadius: 11, flexShrink: 0, background: on ? 'var(--accent)' : 'rgba(var(--fg-rgb),0.12)', position: 'relative', transition: 'background 0.2s', cursor: 'pointer' }}>
      <div style={{ position: 'absolute', top: 2, left: on ? 18 : 2, width: 18, height: 18, borderRadius: '50%', background: 'var(--bg)', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
    </div>
  );
}

export function ChevronVal({ text, small }: { text: string; small?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: small ? 12 : 14, color: 'var(--text-sub)', textAlign: 'right', maxWidth: 200 }}>{text}</span>
      <span style={{ color: 'var(--text-faint)', fontSize: 16 }}>›</span>
    </div>
  );
}

export function InfoModal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="settings-modal" onClick={onClose} role="button" tabIndex={0} aria-label="Закрыть"
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClose(); } }}>
      <div
        role="presentation"
        className="settings-modal-box"
        onClick={e => e.stopPropagation()}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); } }}
      >
        <div className="settings-modal-handle" />
        {children}
      </div>
    </div>
  );
}
