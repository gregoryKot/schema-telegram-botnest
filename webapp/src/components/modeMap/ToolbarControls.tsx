import { useState, useLayoutEffect } from 'react';
import { MMIcon } from '../modeMapIcons';

// Контролы тулбара карты режимов: кнопка с тултипом, разделитель,
// выпадающее меню. Вынесено из ModeMapCanvas.tsx (правило №10).
export function TbBtn({ children, label, onClick, disabled, active, caret }: {
  children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; active?: boolean; caret?: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div style={{ position: 'relative', display: 'flex' }}>
      <button onClick={onClick} disabled={disabled}
        style={{ minWidth: 32, height: 30, padding: caret ? '0 6px 0 8px' : '0 7px', borderRadius: 6, border: 'none',
          cursor: disabled ? 'default' : 'pointer', gap: 3,
          background: active ? 'var(--accent-soft)' : hover && !disabled ? 'var(--surface-2)' : 'none', fontSize: 15, lineHeight: 1,
          color: disabled ? 'var(--text-ghost)' : active ? 'var(--accent)' : 'var(--text-sub)',
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
        {children}{caret && <MMIcon name="caret" size={11} style={{ opacity: 0.65, marginLeft: 1 }} />}
      </button>
      {hover && !disabled && (
        <div style={{ position: 'absolute', top: 36, left: '50%', transform: 'translateX(-50%)', zIndex: 40,
          background: 'var(--text)', color: 'var(--bg)', fontSize: 11, padding: '3px 7px', borderRadius: 5,
          whiteSpace: 'nowrap', pointerEvents: 'none', boxShadow: 'var(--shadow-2)' }}>
          {label}
        </div>
      )}
    </div>
  );
}
export function TbSep() {
  return <div style={{ width: 1, background: 'var(--line)', margin: '4px 2px' }} />;
}

// Anchored to its trigger button and rendered fixed, clamped inside the viewport —
// so it never gets clipped or pushed off-screen by the toolbar's position.
export function Dropdown({ children, onClose, anchorRef }: {
  children: React.ReactNode; onClose: () => void; anchorRef: React.RefObject<HTMLElement | null>;
}) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const r = anchorRef.current?.getBoundingClientRect();
    if (!r) return;
    const WIDTH = 220, MARGIN = 8;
    let left = r.left;
    if (left + WIDTH > window.innerWidth - MARGIN) left = window.innerWidth - MARGIN - WIDTH;
    if (left < MARGIN) left = MARGIN;
    setPos({ left, top: r.bottom + 4 });
  }, [anchorRef]);
  return (
    <>
      <div role="button" tabIndex={0} aria-label="Закрыть" onClick={onClose}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClose(); } }}
        style={{ position: 'fixed', inset: 0, zIndex: 39 }} />
      {pos && (
        <div style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 40, width: 220,
          background: 'var(--bg-elev)', border: '1px solid var(--line)', borderRadius: 8,
          padding: 4, boxShadow: 'var(--shadow-2)' }}>
          {children}
        </div>
      )}
    </>
  );
}
