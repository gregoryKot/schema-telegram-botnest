import { useRef } from 'react';
import { Dropdown } from '../../Dropdown';
import { ConceptMenuItem as MenuItem } from './ConceptMenuItem';
import { useMenuPick } from '../../useMenuPick';
import { CANVAS_HINT, EXPAND_HINT, type GraphActions } from './conceptHeadText';
import { CONCEPT_EXPORT_EMPTY } from '../../../../../shared/src/therapy/conceptExport';

// Меню «⋯ Ещё» шапки вкладки «Концептуализация» (#879): экспорт, картинка, лист на весь экран и холст — редкие
// действия в одном меню, чтобы шапка не читалась как панель инструментов. Закрывается по выбору пункта.
export function ConceptMoreMenu({ onExport, exportEmpty, graph }: { onExport: () => void; exportEmpty: boolean; graph?: GraphActions }) {
  const { open, setOpen, btnRef, pick } = useMenuPick();
  const wrapRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={wrapRef} className="tcp-more">
      <button
        ref={btnRef} type="button"
        className="ds-btn ds-btn--icon"
        aria-label="Ещё действия"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        ⋯<span className="tcp-more-txt"> Ещё</span>
      </button>
      {open && (
        <Dropdown anchorRef={wrapRef} onClose={() => setOpen(false)} role="menu" label="Ещё действия" className="tcp-menu">
          <MenuItem icon="file" disabled={exportEmpty} hint={exportEmpty ? CONCEPT_EXPORT_EMPTY : undefined} onClick={pick(onExport)}>Экспорт текстом</MenuItem>
          {graph && (
            <>
              <MenuItem icon="download" disabled={graph.image.busy} onClick={pick(graph.image.download)}>Скачать картинкой</MenuItem>
              <MenuItem icon="fit" hint={EXPAND_HINT} onClick={pick(graph.expand)}>На весь экран</MenuItem>
              {graph.canvas && (
                <MenuItem icon="map" hint={CANVAS_HINT} disabled={graph.canvas.busy} onClick={pick(graph.canvas.open)}>Открыть на холсте</MenuItem>
              )}
            </>
          )}
        </Dropdown>
      )}
    </div>
  );
}
