import { useRef } from 'react';
import { Dropdown } from './Dropdown';
import { useMenuPick } from './useMenuPick';

// Меню «⋯» с действиями «Переименовать» и «Удалить» (#906): одна механика для
// карточки клиента и карт режимов. Редкие действия живут в меню, а не иконками
// на виду. У ConceptTabHead своё меню на том же Dropdown.
export function RenameDeleteMenu({ label, deleteLabel, onRename, onDelete, deleteBusy }: {
  label: string;
  deleteLabel: string;
  onRename: () => void;
  onDelete?: () => void;
  /** Удаление уже идёт — пункт недоступен. */
  deleteBusy?: boolean;
}) {
  const { open, setOpen, btnRef, pick } = useMenuPick();
  const wrapRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={wrapRef}>
      <button ref={btnRef} type="button" className="ds-btn ds-btn--icon" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}>⋯</button>
      {open && (
        <Dropdown anchorRef={wrapRef} onClose={() => setOpen(false)} role="menu" label={label}>
          <button type="button" role="menuitem" className="ds-menu-item" onClick={pick(onRename)}>Переименовать</button>
          {onDelete && <button type="button" role="menuitem" className="ds-menu-item is-danger" disabled={deleteBusy} onClick={pick(onDelete)}>{deleteLabel}</button>}
        </Dropdown>
      )}
    </div>
  );
}
