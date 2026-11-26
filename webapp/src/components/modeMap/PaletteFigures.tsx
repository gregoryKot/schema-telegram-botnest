import { TYPE_COLORS } from '../modeMapData';
import type { Draft } from './modeDraft';
import { startNodeDrag } from './nodeDrag';
import { PaletteMark } from './PaletteMark';
import { FIGURES } from './paletteModel';

/**
 * Фигуры холста сеткой: бумажный знак и короткая подпись под ним (полная — в подсказке).
 * Клик ставит фигуру на холст, перетаскивание — туда, куда отпустили.
 */
export function PaletteFigures({ onAdd }: { onAdd: (node: Draft) => void }) {
  return (
    <div className="mm2-figs">
      {FIGURES.map(f => (
        <button key={f.type} onClick={() => onAdd(f.draft())} draggable onDragStart={e => startNodeDrag(e, f.draft())}
          className="mm2-fig" title={f.hint}>
          <PaletteMark kind={f.type} color={TYPE_COLORS[f.type]} />
          <span className="mm2-fig-name">{f.caption}</span>
        </button>
      ))}
    </div>
  );
}
