// Строка и заголовок палитры холста — одна сетка: колонка знака (28px) и колонка текста. Знак строки, как в
// «Справочнике»: режим — знак группы 24×14, схема — знак домена; фигура — свой знак. Длинное имя — в две строки.
import type { ReactNode } from 'react';
import { DomainArt } from '../art/DomainArt';
import { GuideSignArt } from '../art/GuideSigns';
import { MMIcon } from '../modeMapIcons';
import type { Draft } from './modeDraft';
import { startNodeDrag } from './nodeDrag';
import { PaletteMark } from './PaletteMark';
import type { PaletteItem } from './paletteModel';

/** Строка палитры: клик кладёт фигуру на холст, перетаскивание — туда, куда отпустили. */
export function PaletteRow({ item, onAdd }: { item: PaletteItem; onAdd: (node: Draft) => void }) {
  return (
    <button onClick={() => onAdd(item.draft())} draggable onDragStart={e => startNodeDrag(e, item.draft())}
      className="mm2-pal-item" title={item.hint ? `${item.name} — ${item.hint}` : item.name}>
      <span className="mm2-pal-mark">
        {item.sign ? <GuideSignArt sign={item.sign} size="nav" /> : item.domain ? <DomainArt domain={item.domain} size="nav" />
          : item.mark !== 'mode' && <PaletteMark kind={item.mark} color={item.color} />}
      </span>
      <span className="mm2-pal-item-name">{item.name}</span>
    </button>
  );
}

interface HeadProps {
  art: ReactNode; // знак группы (svg размера row) — в колонке знака
  title: string;
  hint?: string; // полное имя группы, если подпись короче
  count?: number;
  open?: boolean; onToggle?: () => void; // есть onToggle — заголовок сворачивает группу (кнопка с шевроном)
  children?: ReactNode; // тихое действие справа (только у заголовка без сворачивания: кнопку в кнопку не вложить)
}

/** Заголовок секции палитры: знак, подпись, серое число и тонкий шеврон. */
export function PaletteHead({ art, title, hint, count, open, onToggle, children }: HeadProps) {
  const body = (
    <>
      <span className="mm2-pal-mark">{art}</span>
      <span className="mm2-pal-head-name">{title}</span>
      {count !== undefined && <span className="mm2-pal-head-n">{count}</span>}
    </>
  );
  if (!onToggle) return <div className="mm2-pal-head is-static" title={hint}>{body}{children}</div>;
  return (
    <button onClick={onToggle} aria-expanded={!!open} className="mm2-pal-head" title={hint ?? title}>
      {body}<MMIcon name="caret" size={12} stroke={1.6} className="mm2-pal-chev" />
    </button>
  );
}
