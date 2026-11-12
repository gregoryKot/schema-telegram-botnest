import type { NodeProps } from '@xyflow/react';
import type { ModeNodeData } from './nodeStyle';
import { nodePaper } from './nodePaper';
import { AllHandles, NodeLabel, NodeTools, SideBadge } from './nodeParts';

interface Props extends Pick<NodeProps, 'id' | 'data' | 'selected' | 'type'> {
  /** Форма листа: .mm2-n--<variant> в styles/modemap-paper.css задаёт радиус, ширину и отступы. */
  variant?: 'rect' | 'circle' | 'pill' | 'schema' | 'origin' | 'need';
  hideSchema?: boolean;
}

// Фигура-лист, облегающий текст: бумага оттенка сущности, контур тоном глубже, тень сдвинутым
// слоем (nodePaper). Общая основа «Здорового», «Своего», детского круга, капитуляции и фигур
// схемы случая (ConceptNodes.tsx): отличаются они радиусом, шириной и отступами, а не механикой.
export function RectNode({ id, data, selected, type, variant = 'rect', hideSchema }: Props) {
  const d = data as unknown as ModeNodeData;
  const paper = nodePaper(type, d, selected, `mm2-n--box mm2-n--${variant}`);
  return (
    <div className={paper.className} style={paper.style}>
      <NodeTools id={id} selected={selected} data={d} />
      <SideBadge side={d.side} />
      <AllHandles />
      <div className="mm2-n-face">
        <NodeLabel id={id} data={d} light={!!d.fillFull} hideSchema={hideSchema} />
      </div>
    </div>
  );
}
