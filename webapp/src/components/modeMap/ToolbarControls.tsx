import { useState } from 'react';
import { MMIcon } from '../modeMapIcons';

// Контролы тулбара карты режимов: кнопка с тултипом и разделитель. Вынесено из
// ModeMapCanvas.tsx (правило №10). Выпадающее меню — общий components/Dropdown.
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
