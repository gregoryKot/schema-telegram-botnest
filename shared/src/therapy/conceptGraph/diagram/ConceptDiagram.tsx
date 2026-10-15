import { useId, useState } from 'react';
import type { ConceptGraphModel } from '../conceptGraphTypes';
import type { ConceptLane } from '../modeLanes';
import { DiagramEdges } from './DiagramEdges';
import { DiagramNodeView } from './DiagramNodeView';
import { nodeOpacity, resolveFocus } from './diagramFocus';
import { layoutConceptDiagram } from './diagramLayout';
import { SPACE, type DiagramNode } from './diagramTypes';
import { useContainerWidth } from './useContainerWidth';

/**
 * Диаграмма случая: фигуры режимов на языке карты режимов и линии связей.
 * Режим открывает редактор, схема и потребность включают подсветку своих
 * линий, заготовка пустой клетки зовёт выбор режима этой клетки.
 */
export function ConceptDiagram({
  graph,
  openModeId,
  onToggleMode,
  onPickLane,
}: {
  graph: ConceptGraphModel;
  openModeId: string | null;
  onToggleMode: (modeId: string) => void;
  onPickLane: (lane: ConceptLane) => void;
}) {
  const [ref, width] = useContainerWidth();
  const uid = useId().replace(/:/g, '');
  const [pressedId, setPressedId] = useState<string | null>(null);
  const layout = layoutConceptDiagram(graph, width);
  const focus = resolveFocus(layout, pressedId, openModeId);

  const tap = (n: DiagramNode) => {
    if (n.kind === 'mode' && n.modeId) {
      setPressedId(null);
      onToggleMode(n.modeId);
    } else if (n.kind === 'placeholder' && n.lane) {
      onPickLane(n.lane);
    } else {
      setPressedId((cur) => (cur === n.id ? null : n.id));
    }
  };

  return (
    <div
      ref={ref}
      data-concept-diagram
      style={{ position: 'relative', width: '100%', height: layout.height }}
    >
      <svg
        aria-hidden="true"
        width={layout.width}
        height={layout.height}
        style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}
      >
        {layout.bands.map((b) => (
          <g key={b.id} data-band={b.id}>
            <rect
              x={0}
              y={b.y}
              width={layout.width}
              height={b.h}
              rx={14}
              fill={`color-mix(in srgb, ${b.color} 6%, transparent)`}
            />
            <line
              x1={14}
              x2={layout.width - 14}
              y1={b.y + 0.5}
              y2={b.y + 0.5}
              stroke={`color-mix(in srgb, ${b.color} 38%, transparent)`}
              strokeDasharray="4 4"
            />
          </g>
        ))}
        <DiagramEdges edges={layout.edges} focus={focus} uid={uid} />
        {layout.bands.map((b) => (
          <g key={b.id}>
            <text
              x={SPACE.pad}
              y={b.y + 18}
              fontSize={13}
              fontWeight={700}
              fill={b.color}
            >
              {b.title}
            </text>
            <text
              x={SPACE.pad}
              y={b.y + 33}
              fontSize={11}
              fill="var(--text-sub)"
            >
              {b.subtitle}
            </text>
          </g>
        ))}
      </svg>
      {layout.nodes.map((n) => (
        <DiagramNodeView
          key={n.id}
          node={n}
          opacity={nodeOpacity(n, focus, layout.edges)}
          open={n.modeId !== undefined && n.modeId === openModeId}
          pressed={n.id === pressedId}
          onTap={() => tap(n)}
        />
      ))}
    </div>
  );
}
