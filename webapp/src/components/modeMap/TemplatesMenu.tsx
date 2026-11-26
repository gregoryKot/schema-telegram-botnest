import { useRef, useState } from 'react';
import { TEMPLATES, templateToGraph } from '../modeMapLayout';
import { MMIcon } from '../modeMapIcons';
import { Dropdown } from '../Dropdown';
import { TbBtn } from './ToolbarControls';

type Graph = ReturnType<typeof templateToGraph>;
export type InsertGraph = (ns: Graph['nodes'], es: Graph['edges']) => void;

// Кнопка тулбара «Шаблоны и генерация»: готовые шаблоны и схема из
// концептуализации клиента. Вынесено из ModeMapCanvas.tsx (правило №10).
export function TemplatesMenu({ onInsert, onGenerate }: { onInsert: InsertGraph; onGenerate: () => void }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pick = (fn: () => void) => () => { setOpen(false); fn(); };
  return (
    <div ref={wrapRef} className="mm2-tb">
      <TbBtn label="Шаблоны и генерация" onClick={() => setOpen(o => !o)} active={open} caret><MMIcon name="layers" size={17} /></TbBtn>
      {open && (
        <Dropdown portal anchorRef={wrapRef} onClose={() => setOpen(false)}>
          <div className="ds-label mm2-drop-head">Шаблоны</div>
          {TEMPLATES.map(t => (
            <button key={t.id} className="ds-menu-item"
              onClick={pick(() => { const g = templateToGraph(t); onInsert(g.nodes, g.edges); })}>{t.name}</button>
          ))}
          <div className="mm2-drop-sep" />
          <button onClick={pick(onGenerate)} className="ds-menu-item">Из концептуализации клиента</button>
        </Dropdown>
      )}
    </div>
  );
}
