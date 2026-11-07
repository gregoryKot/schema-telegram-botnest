import type { ButtonHTMLAttributes, CSSProperties } from 'react';
import { DiagramNodeText, EMPTY_HINT } from './DiagramNodeText';
import { DiagramShapeSvg } from './DiagramShape';
import type { DiagramNode } from './diagramTypes';

/** Зона нажатия не меньше 44, даже если фигура ниже (таблетка потребности 38). */
const MIN_HIT = 44;

/** Что кнопка сообщает программам чтения с экрана — у каждого вида фигуры своё. */
function buttonProps(
  node: DiagramNode,
  open?: boolean,
  pressed?: boolean,
  readOnly?: boolean,
): ButtonHTMLAttributes<HTMLButtonElement> {
  // Только чтение: тап по фигуре подсвечивает её линии, редактора нет; имя — текст фигуры.
  if (readOnly && node.kind !== 'placeholder')
    return { 'aria-pressed': !!pressed };
  switch (node.kind) {
    case 'mode':
      return {
        'aria-label': `${node.name}: связи`,
        'aria-expanded': !!open,
        'aria-describedby': node.empty ? `${node.id}:empty` : undefined,
        title: node.empty ? EMPTY_HINT : undefined,
      };
    case 'schema':
      return {
        'aria-label': `Схема ${node.name}: убеждение и опыт`,
        'aria-expanded': !!open,
        'aria-describedby': node.empty ? `${node.id}:empty` : undefined,
        title: node.empty ? EMPTY_HINT : undefined,
      };
    case 'origin':
      return {
        'aria-label': `Как нарушалась потребность: схема ${node.name}`,
        'aria-expanded': !!open,
      };
    case 'need':
      return { 'aria-pressed': !!pressed };
    default:
      return {};
  }
}

/**
 * Одна фигура диаграммы. Режим, схема, овал опыта, потребность и заготовка
 * пустой секции — кнопки: тап открывает редактор, включает подсветку линий или
 * зовёт выбор. Без `onTap` (заготовка на схеме только для чтения) кнопка
 * выключена.
 */
export function DiagramNodeView({
  node,
  opacity,
  open,
  pressed,
  onTap,
  readOnly,
}: {
  node: DiagramNode;
  opacity: number;
  open?: boolean;
  pressed?: boolean;
  onTap?: () => void;
  readOnly?: boolean;
}) {
  const hit = Math.max(node.h, MIN_HIT);
  const dy = (hit - node.h) / 2;
  const style: CSSProperties = {
    position: 'absolute',
    left: node.x,
    top: node.y - dy,
    width: node.w,
    height: hit,
    opacity,
    transition: 'opacity 120ms',
    padding: 0,
    border: 'none',
    background: 'none',
    color: 'var(--text)',
    font: 'inherit',
    textAlign: 'center',
    cursor: onTap ? 'pointer' : 'default',
  };
  return (
    <button
      type="button"
      data-shape={node.shape}
      data-node={node.id}
      onClick={onTap}
      disabled={!onTap}
      style={style}
      {...buttonProps(node, open, pressed, readOnly)}
    >
      <DiagramShapeSvg
        shape={node.shape}
        w={node.w}
        h={node.h}
        top={dy}
        color={node.color}
        open={open || pressed}
        faint={node.empty}
        ghost={node.kind === 'placeholder'}
      />
      <DiagramNodeText node={node} top={dy} />
    </button>
  );
}
