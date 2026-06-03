export interface MenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

interface Props {
  x: number; y: number;
  items: MenuItem[];
  onClose: () => void;
}

export function ModeMapContextMenu({ x, y, items, onClose }: Props) {
  return (
    <>
      {/* Backdrop to close on any click */}
      <div onClick={onClose} onContextMenu={e => { e.preventDefault(); onClose(); }}
        style={{ position: 'fixed', inset: 0, zIndex: 999 }} />
      <div style={{
        position: 'fixed', left: x, top: y, zIndex: 1000,
        background: 'var(--bg-elev)', border: '1px solid rgba(var(--fg-rgb),0.12)',
        borderRadius: 8, padding: 4, minWidth: 170,
        boxShadow: '0 4px 16px rgba(0,0,0,0.16)',
      }}>
        {items.map((it, i) => (
          <button key={i}
            onClick={() => { it.onClick(); onClose(); }}
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '7px 10px', borderRadius: 5, fontSize: 12.5, cursor: 'pointer',
              background: 'none', border: 'none',
              color: it.danger ? 'var(--accent-red)' : 'var(--text)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(var(--fg-rgb),0.06)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}>
            {it.label}
          </button>
        ))}
      </div>
    </>
  );
}
