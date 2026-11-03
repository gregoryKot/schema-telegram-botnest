import { useRef, useState } from 'react';
import type { TherapyClientSummary } from '../../api';
import { Dropdown } from '../Dropdown';
import type { ClientDetail } from './clientSheetTypes';

// Меню «⋯» шапки карточки (#906): редкие действия — переименовать и удалить —
// ушли из шапки в меню, иконок карандаша и корзины больше нет. Та же механика,
// что у «⋯ Ещё» на «Концептуализации» (concept/ConceptTabHead.tsx): общий
// Dropdown с role="menu", пункты .mm2-item (44px на телефоне — .tk-menu).
// Удаление — прежний путь: requestDeleteClient → ConfirmDialog в ClientHeader.
export function ClientHeaderMenu({ selectedClient, detail }: { selectedClient: TherapyClientSummary; detail: ClientDetail }) {
  const { setRenamingAlias, setAliasInput, requestDeleteClient, deleteLoading } = detail;
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pick = (fn: () => void) => () => { setOpen(false); fn(); };
  const rename = () => { setRenamingAlias(true); setAliasInput(selectedClient.clientAlias ?? selectedClient.name ?? ''); };
  return (
    <div ref={wrapRef} className="tk-more">
      <button type="button" className="ds-btn ds-btn--icon" aria-label="Ещё действия" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}>⋯</button>
      {open && (
        <Dropdown anchorRef={wrapRef} onClose={() => setOpen(false)} role="menu" label="Ещё действия" className="tk-menu">
          <button type="button" role="menuitem" className="mm2-item" onClick={pick(rename)}>Переименовать</button>
          <button type="button" role="menuitem" className="mm2-item is-danger" disabled={deleteLoading} onClick={pick(requestDeleteClient)}>Удалить клиента</button>
        </Dropdown>
      )}
    </div>
  );
}
