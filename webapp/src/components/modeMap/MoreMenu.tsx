import { useRef, useState } from 'react';
import { Dropdown } from '../Dropdown';
import { useMenuPick } from '../useMenuPick';
import { TbBtn } from './ToolbarControls';

// «⋯ Ещё» тулбара карты: редкие действия, чтобы основной ряд влезал в узкий холст.
// «Очистить карту…» только открывает подтверждение — саму очистку делает холст
// (ClearMapDialog). Список клавиш — раскрытием внутри меню и только с мышью.
const KEYS: [string, string][] = [
  ['⌘Z / Ctrl+Z', 'Отменить'],
  ['⌘⇧Z / Ctrl+Y', 'Вернуть'],
  ['⌘A / Ctrl+A', 'Выделить всё'],
  ['⌘D', 'Дублировать фигуру'],
  ['Backspace', 'Удалить выбранное'],
  ['Shift + рамка', 'Выделить несколько'],
  ['Двойной клик', 'Переименовать'],
  ['Esc', 'Снять выделение'],
];

export function MoreMenu({ empty, onSelectAll, onClear }: { empty: boolean; onSelectAll: () => void; onClear: () => void }) {
  const { open, setOpen, btnRef, pick } = useMenuPick();
  const [keys, setKeys] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 900px) and (pointer: fine)').matches;
  return (
    <div ref={wrapRef} className="mm2-tb">
      <TbBtn label="Ещё" btnRef={btnRef} onClick={() => { setOpen(o => !o); setKeys(false); }} active={open}>
        <span className="mm2-more-dots" aria-hidden="true">⋯</span>
      </TbBtn>
      {open && (
        <Dropdown anchorRef={wrapRef} onClose={() => setOpen(false)} role="menu" label="Ещё" width={250}>
          <button type="button" role="menuitem" className="ds-menu-item mm2-more-item" disabled={empty}
            aria-keyshortcuts="Meta+A Control+A" onClick={pick(onSelectAll)}>
            Выделить всё<kbd className="mm2-kbd" aria-hidden="true">⌘A</kbd>
          </button>
          {isDesktop && (
            <button type="button" role="menuitem" className="ds-menu-item" aria-expanded={keys}
              onClick={() => setKeys(k => !k)}>Горячие клавиши</button>
          )}
          {isDesktop && keys && KEYS.map(([k, v]) => (
            <div key={k} className="mm2-kbd-row"><span>{v}</span><kbd className="mm2-kbd">{k}</kbd></div>
          ))}
          <div className="mm2-drop-sep" />
          <button type="button" role="menuitem" className="ds-menu-item is-danger" disabled={empty}
            onClick={pick(onClear)}>Очистить карту…</button>
        </Dropdown>
      )}
    </div>
  );
}
