import { useId, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Dropdown } from '../../Dropdown';
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
          <MenuItem disabled={exportEmpty} hint={exportEmpty ? CONCEPT_EXPORT_EMPTY : undefined} onClick={pick(onExport)}>↗ Экспорт текстом</MenuItem>
          {graph && (
            <>
              <MenuItem disabled={graph.image.busy} onClick={pick(graph.image.download)}>↓ Скачать картинкой</MenuItem>
              <MenuItem hint={EXPAND_HINT} onClick={pick(graph.expand)}>⤢ На весь экран</MenuItem>
              {graph.canvas && (
                <MenuItem hint={CANVAS_HINT} disabled={graph.canvas.busy} onClick={pick(graph.canvas.open)}>Открыть на холсте</MenuItem>
              )}
            </>
          )}
        </Dropdown>
      )}
    </div>
  );
}

// Пункт меню: название, под ним — подсказка строкой (видна без hover, в отличие
// от title). Имя пункта для ридера и тестов — только название (aria-labelledby),
// подсказка — его описание.
function MenuItem({ hint, children, ...rest }: { hint?: string; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  const id = useId();
  return (
    <button type="button" role="menuitem" className="ds-menu-item" aria-labelledby={`${id}-l`} aria-describedby={hint ? `${id}-h` : undefined} {...rest}>
      <span id={`${id}-l`}>{children}</span>
      {hint && <span id={`${id}-h`} className="tcp-menu-hint">{hint}</span>}
    </button>
  );
}
