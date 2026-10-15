import type { CSSProperties } from 'react';
import { FIT, FONT, LINE } from './diagramMeasure';
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

function clamp(lines: number): CSSProperties {
  return {
    display: '-webkit-box',
    WebkitLineClamp: lines,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    overflowWrap: 'anywhere',
  };
}

/** Таблетка потребности: одна строка; в узкой — кегль 11, чтобы «Привязанность» влезла. */
function PillText({ node }: { node: DiagramNode }) {
  return (
    <span
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 8px',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        fontSize: node.w < 108 ? 11 : 12,
        fontWeight: 600,
        color: 'var(--text)',
      }}
    >
      {node.label}
    </span>
  );
}

/** Подписи внутри фигуры: название, мелкая строка, подпись и текст терапевта. */
export function DiagramNodeText({
  node,
  top,
}: {
  node: DiagramNode;
  /** Смещение вниз: бокс кнопки выше фигуры. */
  top: number;
}) {
  if (node.kind === 'need') {
    return (
      <span
        style={{
          position: 'absolute',
          left: 0,
          top,
          width: node.w,
          height: node.h,
        }}
      >
        <PillText node={node} />
      </span>
    );
  }
  const left = node.shape === 'rounded' && node.kind !== 'placeholder';
  const { kx, ky } = FIT[node.shape];
  return (
    <span
      style={{
        position: 'absolute',
        left: 0,
        top,
        width: node.w,
        height: node.h,
        boxSizing: 'border-box',
        padding: `${(node.h * (1 - ky)) / 2}px ${(node.w * (1 - kx)) / 2}px`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: left ? 'flex-start' : 'center',
        justifyContent: 'center',
        textAlign: left ? 'left' : 'center',
      }}
    >
      {node.caption && (
        <span
          style={{
            ...clamp(2),
            fontSize: FONT.caption,
            lineHeight: `${LINE.caption}px`,
            fontWeight: 600,
            color: 'var(--text-sub)',
          }}
        >
          {node.caption}
        </span>
      )}
      {node.label && (
        <span
          style={{
            ...clamp(2),
            fontSize: FONT.title,
            lineHeight: `${LINE.title}px`,
            fontWeight: 700,
            color:
              node.kind === 'placeholder' ? 'var(--text-sub)' : 'var(--text)',
          }}
        >
          {node.label}
        </span>
      )}
      {node.sublabel && (
        <span
          style={{
            ...clamp(1),
            fontSize: FONT.sub,
            lineHeight: `${LINE.sub}px`,
            color: 'var(--text-sub)',
          }}
        >
          {node.sublabel}
        </span>
      )}
      {node.body && (
        <span
          style={{
            ...clamp(node.bodyLines ?? 6),
            marginTop: 4,
            fontSize: FONT.body,
            lineHeight: `${LINE.body}px`,
            color: 'var(--text)',
          }}
        >
          {node.body}
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
