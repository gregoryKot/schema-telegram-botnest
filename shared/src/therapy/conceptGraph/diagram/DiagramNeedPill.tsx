import type { CSSProperties } from 'react';
import { colorMix } from '../../../utils/colorMix';
import { NODE_PAPER_LC, paperTone } from '../../../modeMap/nodePaperTone';
import { nodeHue } from './diagramPaper';
import type { DiagramNode } from './diagramTypes';

/** Заливка процента — та же бумага потребности тоном глубже (язык бумаги, без насыщенной заливки);
 *  без оттенка (неизвестная потребность) — приглушённый цвет узла. */
const FILL_MIX = 30;
function pctFill(node: DiagramNode): string {
  const hue = nodeHue(node);
  return hue === undefined
    ? colorMix(node.color, FILL_MIX)
    : paperTone(NODE_PAPER_LC.shade, hue);
}

const box: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 8px',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  fontWeight: 600,
  color: 'var(--text)',
};

/** Число под названием: кегль не ниже 11 (порог читаемости), жирнее названия. */
const PCT: CSSProperties = {
  fontSize: 11,
  lineHeight: '12px',
  fontWeight: 700,
};

/**
 * Таблетка потребности: название одной строкой; в узкой — кегль 11, чтобы
 * «Привязанность» влезла. У оценённой в колесе потребности (`pct`) таблетка
 * залита слева на этот процент, а число стоит под названием: рядом с ним в
 * узкую таблетку оно не помещается, а две строки в высоту 36 входят.
 */
export function DiagramNeedPill({
  node,
  top,
}: {
  node: DiagramNode;
  /** Смещение вниз: бокс кнопки выше фигуры. */
  top: number;
}) {
  const rated = node.pct !== undefined;
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
      {rated && (
        <span
          data-need-fill
          style={{
            position: 'absolute',
            inset: 1,
            borderRadius: node.h / 2,
            overflow: 'hidden',
          }}
        >
          <span
            style={{
              display: 'block',
              width: `${node.pct}%`,
              height: '100%',
              background: pctFill(node),
            }}
          />
        </span>
      )}
      <span
        style={{
          ...box,
          fontSize: node.w < 108 ? 11 : 12,
          lineHeight: rated ? '14px' : undefined,
        }}
      >
        <span>{node.label}</span>
        {rated && (
          <span data-need-pct style={PCT}>
            {node.pct}%
          </span>
        )}
      </span>
    </span>
  );
}
