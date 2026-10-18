import { useState, type ReactNode } from 'react';

/** Свёрнутая по умолчанию «Все N схем ›» — полная карта уходит из первого плана на телефоне. */
export function SchemaMapFold({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="cs-fold">
      <button className="cs-fold-btn" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <span>{label}</span><span className={`cs-fold-chev${open ? ' is-open' : ''}`} aria-hidden>›</span>
      </button>
      {open && children}
    </div>
  );
}
