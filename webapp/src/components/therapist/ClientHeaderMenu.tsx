import { useRef } from 'react';
import { Dropdown } from '../Dropdown';
import { useMenuPick } from '../useMenuPick';


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
  const { open, setOpen, btnRef, pick } = useMenuPick();
  const wrapRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={wrapRef}>
      <button ref={btnRef} type="button" className="ds-btn ds-btn--icon" aria-label="Действия с карточкой" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}>⋯</button>
      {open && (
        <Dropdown anchorRef={wrapRef} onClose={() => setOpen(false)} role="menu" label="Действия с карточкой" className="tk-menu">
          <button type="button" role="menuitem" className="mm2-item" onClick={pick(onRename)}>Переименовать</button>
          <button type="button" role="menuitem" className="mm2-item is-danger" disabled={deleteBusy} onClick={pick(onDelete)}>Удалить клиента</button>
        </Dropdown>
      )}
    </div>
  );
}
