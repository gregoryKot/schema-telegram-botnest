import { useState, type ReactNode } from 'react';

/** Свёрнутая по умолчанию «Все N схем ›» — полная карта уходит из первого плана на телефоне. */
export function SchemaMapFold({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ds-fold">
      <button type="button" className="ds-fold-btn" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <span className="ds-label">{label}</span><span className="ds-fold-chev" aria-hidden="true" />
      </button>
      {open && <div className="ds-fold-body">{children}</div>}
    </div>
  );
}
