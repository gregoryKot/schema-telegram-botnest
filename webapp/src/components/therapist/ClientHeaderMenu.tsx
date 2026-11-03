import { useRef, useState } from 'react';
import { Dropdown } from '../Dropdown';

interface Props {
  onRename: () => void;
  onDelete: () => void;
  /** Удаление уже идёт — пункт недоступен. */
  deleteBusy: boolean;
}

// Меню «⋯» шапки карточки (#906): редкие действия — переименовать и удалить —
// ушли из шапки в меню, иконок карандаша и корзины больше нет. Та же механика,
// что у «⋯ Ещё» на «Концептуализации» (concept/ConceptTabHead.tsx): общий
// Dropdown с role="menu", пункты .mm2-item (тап-цель 44 — .tk-menu). Обработчики
// приходят из ClientHeader; удаление — прежний путь requestDeleteClient → ConfirmDialog.
export function ClientHeaderMenu({ onRename, onDelete, deleteBusy }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pick = (fn: () => void) => () => { setOpen(false); fn(); };
  return (
    <div ref={wrapRef}>
      <button type="button" className="ds-btn ds-btn--icon" aria-label="Действия с карточкой" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}>⋯</button>
      {open && (
        <Dropdown anchorRef={wrapRef} onClose={() => setOpen(false)} role="menu" label="Действия с карточкой" className="tk-menu">
          <button type="button" role="menuitem" className="mm2-item" onClick={pick(onRename)}>Переименовать</button>
          <button type="button" role="menuitem" className="mm2-item is-danger" disabled={deleteBusy} onClick={pick(onDelete)}>Удалить клиента</button>
        </Dropdown>
      )}
    </div>
  );
}
