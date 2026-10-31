import { useState, type ReactNode } from 'react';
import '../styles/sheet-tracker.css';

/** Раскрывающийся блок листа потребности: карточка с заголовком-кнопкой. */
export function NeedFold({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ds-card ds-card--row">
      <button onClick={() => setOpen((v) => !v)} className="tk2-toggle" aria-expanded={open}>
        <span className="ds-label">{title}</span><span className="ds-sub" aria-hidden>{open ? '▴' : '▾'}</span>
      </button>
      {open && children}
    </div>
  );
}
