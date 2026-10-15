import type { ButtonHTMLAttributes, CSSProperties } from 'react';
import { DiagramNodeText, EMPTY_HINT } from './DiagramNodeText';
import { DiagramShapeSvg } from './DiagramShape';
import type { DiagramNode } from './diagramTypes';

/** Зона нажатия не меньше 44, даже если фигура ниже (схема 40, потребность 36). */
const MIN_HIT = 44;

/** Что кнопка сообщает программам чтения с экрана — у каждого вида фигуры своё. */
function buttonProps(
  node: DiagramNode,
  open?: boolean,
  pressed?: boolean,
): ButtonHTMLAttributes<HTMLButtonElement> | null {
  switch (node.kind) {
    case 'mode':
      return {
        'aria-label': `${node.name}: связи`,
        'aria-expanded': !!open,
        'aria-describedby': node.empty ? `${node.id}:empty` : undefined,
        title: node.empty ? EMPTY_HINT : undefined,
      };
    case 'schema':
    case 'need':
      return { 'aria-pressed': !!pressed };
    case 'placeholder':
      return { title: node.title };
    default:
      return null;
  }
}

/**
 * Одна фигура диаграммы. Режим, схема, потребность и заготовка пустой клетки —
 * кнопки; текстовые поля концептуализации — просто подписанные фигуры.
 */
export function DiagramNodeView({
  node,
  opacity,
  open,
  pressed,
  onTap,
}: {
  node: DiagramNode;
  opacity: number;
  open?: boolean;
  pressed?: boolean;
  onTap?: () => void;
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
  };
  const body = (
    <>
      <DiagramShapeSvg
        shape={node.shape}
        w={node.w}
        h={node.h}
        top={dy}
        color={node.color}
        open={open}
        faint={node.empty}
        ghost={node.kind === 'placeholder'}
      />
      <DiagramNodeText node={node} top={dy} />
    </>
  );
  const button = buttonProps(node, open, pressed);
  if (button) {
    return (
      <button
        type="button"
        data-shape={node.shape}
        data-node={node.id}
        onClick={onTap}
        style={{ ...style, cursor: 'pointer' }}
        {...button}
      >
        {body}
      </button>
    );
  }
  return (
    <div
      data-shape={node.shape}
      data-node={node.id}
      title={node.title}
      style={style}
    >
      {body}
    </div>
  );
}
