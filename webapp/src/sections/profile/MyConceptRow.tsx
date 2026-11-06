import { useState } from 'react';
import { MyConceptSheet } from './MyConceptSheet';

// Строка «Схема случая» в карточке «Терапевт» профиля: появляется, только когда терапевт
// включил «Показать клиенту» (relation.conceptSharedAt). Тап открывает лист со схемой.
export function MyConceptRow() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="ds-list-row ds-list-row--nav ds-list-row--inset ds-list-row--hover cpf-therapist-concept" onClick={() => setOpen(true)}>
        <span className="ds-list-body">
          <span className="ds-list-title">Схема случая</span>
          <span className="ds-sub">Схемы, режимы и потребности, собранные с терапевтом</span>
        </span>
        <span className="ds-chev" aria-hidden="true" />
      </button>
      {open && <MyConceptSheet onClose={() => setOpen(false)} />}
    </>
  );
}
