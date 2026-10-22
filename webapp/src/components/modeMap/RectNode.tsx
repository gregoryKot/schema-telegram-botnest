import type { NodeProps } from '@xyflow/react';
import { fillColor, strokePx, type ModeNodeData } from './nodeStyle';
import { AllHandles, NodeLabel, NodeTools, SideBadge } from './nodeParts';

interface Props extends Pick<NodeProps, 'id' | 'data' | 'selected'> {
  defaultColor: string;
  radius?: number | string;
  minW?: number;
  maxW?: number;
  padding?: string;
  hideSchema?: boolean;
}

// Фигура, облегающая текст: рамка с радиусом, заливка цветом типа. Общая основа
// «Здорового», «Своего» и фигур схемы случая (ConceptNodes.tsx): отличаются они
// радиусом, шириной и отступами, а не механикой.
export function RectNode({
  id, data, selected, defaultColor, radius = 10, minW = 110, maxW = 260,
  padding = '10px 16px', hideSchema,
}: Props) {
  const d = data as unknown as ModeNodeData;
  const color = d.customColor ?? defaultColor;
  const light = !!d.fillFull;
  return (
    <div style={{ position: 'relative', width: 'max-content', minWidth: minW, maxWidth: maxW, minHeight: 40 }}>
      <NodeTools id={id} selected={selected} data={d} />
      <SideBadge side={d.side} />
      <AllHandles />
      <div style={{
        borderRadius: radius,
        background: fillColor(color, d.filled, d.fillFull),
        border: `${strokePx(d)}px solid ${selected ? 'var(--accent)' : color}`,
        boxShadow: selected ? '0 0 0 3px var(--accent-line)' : 'var(--shadow-1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', padding, boxSizing: 'border-box',
      }}>
        <NodeLabel id={id} data={d} light={light} hideSchema={hideSchema} />
      </div>
    </div>
  );
}
