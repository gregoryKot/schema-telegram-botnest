import type { NodeProps } from '@xyflow/react';
import { TYPE_COLORS } from '../modeMapData';
import { fillColor, strokePx, type ModeNodeData } from './nodeStyle';
import { AllHandles, NodeLabel, NodeTools, SideBadge } from './nodeParts';
import { RectNode } from './RectNode';
import { HUB_DIAMETER } from './hubGeometry';
import { isWheel } from './needWheel';
import { NeedWheelNode } from './NeedWheelNode';

// Фигуры схемы случая на холсте (conceptToModeMap): схема с убеждением, овал «Как нарушалась потребность»,
// таблетка потребности, круг потребностей. Механика общая (RectNode, nodeParts): разные радиус и отступы.

/** Схема: прямоугольник; название схемы — сам заголовок, поэтому таблетки схемы под текстом нет. */
export function SchemaNode(props: NodeProps) {
  return <RectNode {...props} defaultColor={TYPE_COLORS.schema} radius={6} minW={190} maxW={250} hideSchema />;
}

/** Мягкое пятно с щедрыми отступами: текст опыта не упирается в края. */
const BLOB = '46% 54% 50% 50% / 52% 46% 54% 48%';
export function OriginNode(props: NodeProps) {
  return <RectNode {...props} defaultColor={TYPE_COLORS.origin} radius={BLOB} minW={190} maxW={215} padding="24px 30px" hideSchema />;
}

/** Потребность — таблетка. */
export function NeedNode(props: NodeProps) {
  return <RectNode {...props} defaultColor={TYPE_COLORS.need} radius={9999} minW={100} maxW={170} padding="8px 12px" hideSchema />;
}

/** Круг потребностей: колесо (NeedWheelNode); старый круг-рамка с таблетками внутри — фиксированный диаметр, подпись сверху. */
export function NeedsHubNode({ id, data, selected }: NodeProps) {
  const d = data as unknown as ModeNodeData;
  if (isWheel(d)) return <NeedWheelNode id={id} data={d} selected={selected} />;
  const color = d.customColor ?? TYPE_COLORS.needs;
  const size = d.diameter ?? HUB_DIAMETER;
  return (
    <div style={{ position: 'relative', width: size, height: size, borderRadius: '50%' }}>
      <NodeTools id={id} selected={selected} data={d} />
      <SideBadge side={d.side} />
      <AllHandles />
      <div style={{
        width: size, height: size, borderRadius: '50%', boxSizing: 'border-box',
        background: fillColor(color, d.filled, d.fillFull),
        border: `${strokePx(d)}px solid ${selected ? 'var(--accent)' : color}`,
        boxShadow: selected ? '0 0 0 3px var(--accent-line)' : 'var(--shadow-1)',
        display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: Math.round(size * 0.2),
      }}>
        <div style={{ maxWidth: '78%' }}>
          <NodeLabel id={id} data={d} light={!!d.fillFull} hideSchema />
        </div>
      </div>
    </div>
  );
}
