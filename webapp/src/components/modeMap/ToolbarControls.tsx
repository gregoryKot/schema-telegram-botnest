import { useState, useLayoutEffect } from 'react';
import { MMIcon } from '../modeMapIcons';

// Контролы тулбара карты режимов: кнопка с тултипом, разделитель,
// выпадающее меню. Вынесено из ModeMapCanvas.tsx (правило №10).
export function TbBtn({ children, label, onClick, disabled, active, caret }: {
  children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; active?: boolean; caret?: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div className="mm2-tb">
      <button onClick={onClick} disabled={disabled}
        className={`ds-btn ds-btn--icon mm2-tb-btn${active ? ' is-active' : ''}`}
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
        {children}{caret && <MMIcon name="caret" size={11} className="mm2-tb-caret" />}
      </button>
      {hover && !disabled && <div className="mm2-tip">{label}</div>}
    </div>
  );
}
export function TbSep() {
  return <div className="mm2-tb-sep" />;
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
        className="mm2-backdrop" style={{ zIndex: 39 }} />
      {pos && (
        <div className="ds-card mm2-drop" style={{ top: pos.top, left: pos.left }}>
          {children}
        </div>
      )}
    </>
  );
}
