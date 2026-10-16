import '../styles/sheet-modemap.css';

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
      <div role="button" tabIndex={0} aria-label="Закрыть" onClick={onClose}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClose(); } }}
        onContextMenu={e => { e.preventDefault(); onClose(); }}
        className="mm2-ctx-back" />
      <div className="ds-card mm2-ctx" style={{ left: x, top: y }}>
        {items.map((it, i) => (
          <button key={i} className={`mm2-item${it.danger ? ' is-danger' : ''}`}
            onClick={() => { it.onClick(); onClose(); }}>
            {it.label}
          </button>
        ))}
      </div>
    </>
  );
}
