import { useReactFlow, useStore } from '@xyflow/react';
import { MMIcon } from '../modeMapIcons';
import { TbBtn } from './ToolbarControls';

// Масштаб холста — отдельной группой в нижнем левом углу, как у досок (Miro,
// FigJam, Excalidraw, tldraw): верхний тулбар держит работу с картой и влезает
// в холст между палитрой и панелью свойств. Процент — текущий зум, клик по нему
// возвращает 100%.
export function ZoomBar({ onFit }: { onFit: () => void }) {
  const { zoomIn, zoomOut, zoomTo } = useReactFlow();
  const pct = useStore(s => Math.round(s.transform[2] * 100));
  return (
    <div className="ds-card mm2-toolbar mm2-zoombar">
      <TbBtn label="Отдалить" onClick={() => void zoomOut()}><MMIcon name="minus" size={17} /></TbBtn>
      <button type="button" className="ds-btn ds-btn--icon mm2-tb-btn mm2-zoom-pct" title="Масштаб 100%"
        aria-label={`Масштаб ${pct}%, вернуть 100%`} onClick={() => void zoomTo(1)}>{pct}%</button>
      <TbBtn label="Приблизить" onClick={() => void zoomIn()}><MMIcon name="plus" size={17} /></TbBtn>
      <TbBtn label="Показать всё" onClick={onFit}><MMIcon name="fit" size={17} /></TbBtn>
    </div>
  );
}
