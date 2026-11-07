import type { CSSProperties, ReactNode } from 'react';
import { startNodeDrag } from './nodeDrag';
import type { Draft } from './modeDraft';

export interface PaletteGroupItem { id: string; name: string; title?: string; draft: () => Draft }

interface Props {
  /** Уникален среди всех групп палитры (общий openGroups). */
  id: string;
  title: string;
  /** Цвет группы/домена = цвет её фигур на холсте → `--gc` для точек и подложки пунктов. */
  color: string;
  /** Знак группы режимов или домена схем (svg размера row) — в заголовке вместо точки. */
  art: ReactNode;
  /** Сколько всего пунктов в группе (счётчик в свёрнутом заголовке). */
  total: number;
  items: PaletteGroupItem[];
  open: boolean;
  /** Поиск: список раскрыт принудительно, заголовок не переключается. */
  searching: boolean;
  onToggle: (id: string) => void;
  onAdd: (node: Draft) => void;
}

/** Сворачиваемая группа палитры: группа режимов каталога и домен схем — одна механика. */
export function PaletteGroup({ id, title, color, art, total, items, open, searching, onToggle, onAdd }: Props) {
  const isOpen = searching || open;
  return (
    // Цвет группы = цвет её узла на холсте, не тон кабинета.
    <div data-group={id} style={{ '--gc': color } as CSSProperties}>
      <button onClick={() => !searching && onToggle(id)} aria-expanded={isOpen}
        className={`mm2-pal-head${searching ? ' is-static' : ''}`}>
        <span className="pp-row-art">{art}</span>
        <span className="mm2-pal-head-name">{title}</span>
        {!searching && <span className="mm2-pal-head-n">{isOpen ? '▲' : `▼ ${total}`}</span>}
      </button>
      {isOpen && items.map(item => (
        <button key={item.id} onClick={() => onAdd(item.draft())}
          draggable onDragStart={e => startNodeDrag(e, item.draft())}
          className="mm2-pal-item is-tone" title={item.title}>
          <i className="ds-dot mm2-gdot" />
          <span className="mm2-pal-item-name">{item.name}</span>
        </button>
      ))}
    </div>
  );
}
