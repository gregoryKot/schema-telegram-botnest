import type { ModeMapNode } from '../../api';
import { IdentityDot } from '../../../../shared/src/components/IdentityDot';
import { NEEDS_TITLE } from '../../../../shared/src/therapy/conceptGraph/diagram/diagramCircle';
import { TYPE_COLORS } from '../modeMapData';
import { HUB_DIAMETER } from './hubGeometry';
import { nodeTexts } from './nodeTexts';

type Draft = Omit<ModeMapNode, 'position'>;

interface Props {
  onAdd: (node: Draft) => void;
  onDragStart: (e: React.DragEvent, node: Draft) => void;
}

// Фигуры схемы случая: тип и подсказка пункта. Название и текст по умолчанию берутся из
// nodeTexts (одни и те же слова в палитре и в редакторе). Клик ставит фигуру на холст,
// перетаскивание — туда, куда отпустили.
type Item = { type: 'schema' | 'origin' | 'need' | 'needs'; hint?: string };
const ITEMS: Item[] = [
  { type: 'schema', hint: 'Схема с убеждением' },
  { type: 'origin' },
  { type: 'need', hint: 'Одна из пяти потребностей' },
  { type: 'needs', hint: 'Потребности внутри едут вместе с кругом' },
];

const draft = ({ type }: Item): Draft => {
  const texts = nodeTexts(type);
  const label = type === 'origin' ? texts.note : type === 'needs' ? NEEDS_TITLE : texts.title;
  return { id: `${type}_${Date.now()}`, type, data: type === 'needs' ? { label, diameter: HUB_DIAMETER } : { label } };
};

/** Секция палитры «Схема случая»: фигуры, из которых собирается схема на холсте. */
export function ConceptPaletteItems({ onAdd, onDragStart }: Props) {
  return (
    <div className="mm2-mine">
      <div className="mm2-mine-head"><span className="mm2-pal-head-name">Схема случая</span></div>
      {ITEMS.map((item) => {
        const hint = item.hint ?? nodeTexts(item.type).note;
        return (
          <button key={item.type} onClick={() => onAdd(draft(item))}
            draggable onDragStart={(e) => onDragStart(e, draft(item))}
            className="mm2-pal-item" title={hint} aria-label={hint}>
            <IdentityDot color={TYPE_COLORS[item.type]} size={12} />
            <span className="mm2-pal-item-name">{nodeTexts(item.type).title}</span>
          </button>
        );
      })}
    </div>
  );
}
