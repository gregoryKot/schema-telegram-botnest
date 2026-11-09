import { useState } from 'react';
import { Panel } from '@xyflow/react';
import type { FlowNode } from '../modeMapFlow';
import { MMIcon } from '../modeMapIcons';
import { TbBtn, TbSep } from './ToolbarControls';
import { DownloadMenu } from './DownloadMenu';
import { TemplatesMenu, type InsertGraph } from './TemplatesMenu';
import { MoreMenu } from './MoreMenu';

interface Toggle { on: boolean; toggle: () => void }
interface Props {
  nodes: FlowNode[];
  canUndo: boolean; canRedo: boolean; onUndo: () => void; onRedo: () => void;
  onAutoLayout: () => void; onInsert: InsertGraph; onGenerate: () => void;
  snap: Toggle; zones: Toggle; guide: Toggle; legend: Toggle;
  onSelectAll: () => void; onClear: () => void;
}

// Верхний тулбар холста: история | раскладка, сетка, зоны, шаблоны | подсказки,
// легенда | скачать, «⋯ Ещё». Масштаб — внизу слева (ZoomBar), редкое — в «Ещё»:
// так ряд влезает в холст между палитрой и панелью свойств, а на совсем узком
// переносится строкой (.mm2-toolbar, flex-wrap), а не уходит за край.
export function CanvasToolbar(p: Props) {
  const [dlOpen, setDlOpen] = useState(false);
  const empty = p.nodes.length === 0;
  return (
    <Panel position="top-left">
      <div className="ds-card mm2-toolbar">
        <TbBtn label="Отменить (⌘Z)" disabled={!p.canUndo} onClick={p.onUndo}><MMIcon name="undo" size={17} /></TbBtn>
        <TbBtn label="Вернуть (⌘⇧Z)" disabled={!p.canRedo} onClick={p.onRedo}><MMIcon name="redo" size={17} /></TbBtn>
        <TbSep />
        <TbBtn label="Разложить автоматически" onClick={p.onAutoLayout} disabled={empty}><MMIcon name="auto" size={17} /></TbBtn>
        <TbBtn label="Привязка к сетке" onClick={p.snap.toggle} active={p.snap.on}><MMIcon name="grid" size={17} /></TbBtn>
        <TbBtn label="Зоны: Здоровый Взрослый / копинги / детские и критики" onClick={p.zones.toggle} active={p.zones.on}>
          <MMIcon name="zones" size={17} />
        </TbBtn>
        <TemplatesMenu onInsert={p.onInsert} onGenerate={p.onGenerate} />
        <TbSep />
        <TbBtn label="Подсказки: клиническая цепочка и советы" onClick={p.guide.toggle} active={p.guide.on}><MMIcon name="bulb" size={17} /></TbBtn>
        <TbBtn label="Легенда: формы и цвета" onClick={p.legend.toggle} active={p.legend.on}><MMIcon name="info" size={17} /></TbBtn>
        <TbSep />
        <DownloadMenu nodes={p.nodes} open={dlOpen} onToggle={() => setDlOpen(o => !o)} onClose={() => setDlOpen(false)} />
        <MoreMenu empty={empty} onSelectAll={p.onSelectAll} onClear={p.onClear} />
      </div>
    </Panel>
  );
}
