import { useState, type ReactNode } from 'react';

/** Раскрывающийся блок — общий ds-fold (cabinet.css): карточка с заголовком-кнопкой капителью
 *  и шевроном, тело рендерится только открытым. Лист потребности и концептуализация (#906). */
export function NeedFold({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ds-fold">
      <button type="button" onClick={() => setOpen((v) => !v)} className="ds-fold-btn" aria-expanded={open}>
        <span className="ds-label">{title}</span><span className="ds-fold-chev" aria-hidden="true" />
      </button>
      {open && <div className="ds-fold-body">{children}</div>}
    </div>
  );
}
