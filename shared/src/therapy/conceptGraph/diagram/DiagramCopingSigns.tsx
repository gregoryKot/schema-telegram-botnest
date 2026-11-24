// Стили копинга у фигуры схемы (#1484, «Про клиента»): знаки стилей (CopingSigns сайта
// через ConceptPaper) в углу и подпись словами для ридера — знаки декоративные.
import type { CSSProperties } from 'react';
import { COPING_STYLE } from '../../../schemaTherapy/guide/copingStyles';
import { ConceptSign } from '../conceptPaper';
import type { DiagramNode } from './diagramTypes';

/** Стили копинга схемы словами — для ридера: знаки декоративные. */
export function copingText(node: DiagramNode): string {
  const labels = (node.coping ?? []).map((id) => COPING_STYLE[id].label);
  return labels.length > 0 ? ` (копинг: ${labels.join(', ')})` : '';
}

/** Видно только программам чтения с экрана (схема клиента без aria-label кнопки). */
const SR_ONLY: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
};

/** Знаки стилей копинга в правом верхнем углу фигуры схемы (#1484). */
export function CopingSigns({ node, top }: { node: DiagramNode; top: number }) {
  if (!node.coping?.length) return null;
  return (
    <span
      data-coping={node.coping.join(' ')}
      style={{
        position: 'absolute',
        top: top + 4,
        right: 6,
        display: 'flex',
        gap: 2,
      }}
    >
      {node.coping.map((id) => (
        <ConceptSign key={id} sign={COPING_STYLE[id].sign} />
      ))}
      <span style={SR_ONLY}>{copingText(node)}</span>
    </span>
  );
}
