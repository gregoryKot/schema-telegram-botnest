import type { CSSProperties } from 'react';
import {
  clampLines,
  isLeftAligned,
  isTextNode,
  labelSize,
  sublabelLines,
  textInset,
} from './diagramText';
import type { DiagramNode } from './diagramTypes';

export const EMPTY_HINT = 'связи не заполнены';

/** Видно только программам чтения с экрана. */
const hidden: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
};

/** Подписи внутри фигуры: название, мелкая строка под ним, пометка «связи не заполнены». */
export function DiagramNodeText({
  node,
  top,
}: {
  node: DiagramNode;
  /** Смещение вниз: бокс кнопки выше фигуры. */
  top: number;
}) {
  const text = isTextNode(node);
  const left = isLeftAligned(node);
  return (
    <span
      style={{
        position: 'absolute',
        left: 0,
        top,
        width: node.w,
        height: node.h,
        boxSizing: 'border-box',
        padding: textInset(node),
        display: 'flex',
        flexDirection: 'column',
        alignItems: left ? 'flex-start' : 'center',
        justifyContent: 'center',
        textAlign: left ? 'left' : 'center',
        gap: 'var(--space-2)',
      }}
    >
      <span
        style={{
          ...clampLines(node.kind === 'mode' ? 2 : text ? 1 : 2),
          fontSize: labelSize(node),
          fontWeight: text ? 700 : 600,
          lineHeight: 1.2,
          color:
            node.kind === 'placeholder' ? 'var(--text-sub)' : 'var(--text)',
          letterSpacing: text ? '0.04em' : undefined,
          textTransform: text ? 'uppercase' : undefined,
        }}
      >
        {node.label}
      </span>
      {node.sublabel && (
        <span
          style={{
            ...clampLines(sublabelLines(node)),
            fontSize: text ? 12 : 11,
            lineHeight: 1.25,
            color: 'var(--text-sub)',
          }}
        >
          {node.sublabel}
        </span>
      )}
      {node.empty && (
        <span id={`${node.id}:empty`} style={hidden}>
          {EMPTY_HINT}
        </span>
      )}
    </span>
  );
}
