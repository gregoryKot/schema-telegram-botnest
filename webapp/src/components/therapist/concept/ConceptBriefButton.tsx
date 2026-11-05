import { useState } from 'react';
import { api } from '../../../api';
import type { ClientDetail } from '../clientSheetTypes';
import { ConceptBriefSheet, BRIEF_TITLE } from './ConceptBriefSheet';

// Кнопка «Главное» в шапке вкладки «Концептуализация»: открывает экран с самым
// важным на одном экране (ConceptBriefSheet). Своя кнопка, а не пункт «⋯ Ещё»:
// это главный быстрый путь терапевта перед сессией, а меню — для редких действий.
export function ConceptBriefButton({ detail }: { detail: ClientDetail }) {
  const [open, setOpen] = useState(false);
  const show = () => {
    api.trackEvent('concept_brief_open');
    setOpen(true);
  };
  return (
    <>
      <button type="button" className="ds-btn ds-btn--secondary tcp-brief-btn" onClick={show}>
        ⊞ {BRIEF_TITLE}
      </button>
      {open && <ConceptBriefSheet detail={detail} onClose={() => setOpen(false)} />}
    </>
  );
}
