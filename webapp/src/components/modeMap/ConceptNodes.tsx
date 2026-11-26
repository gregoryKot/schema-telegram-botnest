import type { NodeProps } from '@xyflow/react';
import type { ModeNodeData } from './nodeStyle';
import { nodePaper } from './nodePaper';
import { AllHandles, NodeLabel, NodeTools, SideBadge } from './nodeParts';
import { RectNode } from './RectNode';
import { HUB_DIAMETER } from './hubGeometry';
import { isWheel } from './needWheel';
import { NeedWheelNode } from './NeedWheelNode';

// Фигуры схемы случая на холсте (conceptToModeMap): схема с убеждением, овал «Как нарушалась потребность»,
// таблетка потребности, круг потребностей. Механика общая (RectNode, nodeParts): разные радиус и отступы.

/** Схема: два слоя бумаги (как знак схемы в палитре); название схемы — сам заголовок, поэтому таблетки схемы под текстом нет. */
export const SchemaNode = (props: NodeProps) => <RectNode {...props} variant="schema" hideSchema />;

/** Мягкое пятно с щедрыми отступами: текст опыта не упирается в края. */
export const OriginNode = (props: NodeProps) => <RectNode {...props} variant="origin" hideSchema />;

/** Потребность — таблетка. */
export const NeedNode = (props: NodeProps) => <RectNode {...props} variant="need" hideSchema />;

/** Круг потребностей: колесо (NeedWheelNode); старый круг-рамка с таблетками внутри — фиксированный диаметр, подпись сверху. */
export function NeedsHubNode({ id, data, selected, type }: NodeProps) {
  const d = data as unknown as ModeNodeData;
  if (isWheel(d)) return <NeedWheelNode id={id} data={d} selected={selected} />;
  const size = d.diameter ?? HUB_DIAMETER;
  const paper = nodePaper(type, d, selected, 'mm2-n--box mm2-n--hub');
  return (
    <div className={paper.className} style={{ ...paper.style, width: size, height: size }}>
      <NodeTools id={id} selected={selected} data={d} />
      <SideBadge side={d.side} />
      <AllHandles />
      <div className="mm2-n-face" style={{ paddingTop: Math.round(size * 0.2) }}>
        <div className="mm2-n-hub-label"><NodeLabel id={id} data={d} light={!!d.fillFull} hideSchema /></div>
      </div>
    </div>
  );
}
