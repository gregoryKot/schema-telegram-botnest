// «Зачем это?» у заметки к дню — вспомогательное тише главного (docs/design/APP_2026-11.md,
// принцип 5): на телефоне свёрнутой строкой между листом и полем (до поля только шапка),
// на компьютере — раскрыто под листом в колонке разворота. Раскрывается тапом, не наведением.
import { useState } from 'react';
import { isPhoneLayout } from '../utils/phoneLayout';

export function NoteWhy() {
  const [open, setOpen] = useState(() => !isPhoneLayout());
  return (
    <div className="sd-why">
      <button type="button" className="sd-why-btn" aria-expanded={open} onClick={() => setOpen(v => !v)}>
        <span className="ds-label">Зачем это?</span>
        <span className="sd-why-title">Рефлексия помогает</span>
        <span className="ds-fold-chev" aria-hidden="true" />
      </button>
      {open && <p className="sd-why-body">Регулярные короткие записи помогают увидеть паттерны и понять, что происходит внутри.</p>}
    </div>
  );
}
