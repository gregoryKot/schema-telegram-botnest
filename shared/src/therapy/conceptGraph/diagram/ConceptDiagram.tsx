import { useId, useState, type ReactNode } from 'react';
import type { ConceptGraphModel } from '../conceptGraphTypes';
import { DiagramEdges } from './DiagramEdges';
import { DiagramNodeView } from './DiagramNodeView';
import { DiagramSectionHeader } from './DiagramSectionHeader';
import { nodeOpacity, resolveFocus } from './diagramFocus';
import { layoutConceptDiagram } from './diagramLayout';
import { HEAD_H } from './diagramSections';
import type { AddSection, DiagramNode } from './diagramTypes';
import { useContainerWidth } from './useContainerWidth';

const PANEL_W = 380;
const PANEL_MARGIN = 8;

/**
 * Диаграмма случая: круг базовых потребностей в центре, слева схемы с
 * убеждением и опытом и ещё левее режимы, справа Здоровый Взрослый. Режим и
 * схема открывают свои редакторы, потребность включает подсветку своих линий
 * (✗ и ✓), заготовка пустой секции и «+» в заголовке зовут выбор.
 */
export function ConceptDiagram({
  graph,
  openId,
  addOpen,
  panel,
  onOpenMode,
  onOpenSchema,
  onAdd,
}: {
  graph: ConceptGraphModel;
  /** Открытый редактор: `mode:<id>` или `schema:<id>`. */
  openId: string | null;
  /** Секция, у которой сейчас открыт выбор («+ режим», «+ схема»). */
  addOpen: AddSection | null;
  /** Содержимое выбора; рисуется под заголовком открытой секции. */
  panel: ReactNode;
  onOpenMode: (modeId: string) => void;
  onOpenSchema: (schemaId: string) => void;
  onAdd: (section: AddSection) => void;
}) {
  const [ref, width] = useContainerWidth();
  const uid = useId().replace(/:/g, '');
  const [pressedId, setPressedId] = useState<string | null>(null);
  const layout = layoutConceptDiagram(graph, width);
  const focus = resolveFocus(layout, pressedId, openId);
  const { circle } = layout;
  const panelAt = layout.sections.find((s) => s.id === addOpen);
  const panelW = layout.wide ? PANEL_W : layout.width - 2 * PANEL_MARGIN;

  const tap = (n: DiagramNode) => {
    if (n.kind === 'need') {
      setPressedId((cur) => (cur === n.id ? null : n.id));
      return;
    }
    setPressedId(null);
    if (n.kind === 'mode' && n.modeId) onOpenMode(n.modeId);
    else if ((n.kind === 'schema' || n.kind === 'origin') && n.schemaId) {
      onOpenSchema(n.schemaId);
    } else if (n.kind === 'placeholder' && n.section !== 'needs')
      onAdd(n.section);
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
        <circle
          data-needs-circle
          cx={circle.cx}
          cy={circle.cy}
          r={circle.r}
          fill="color-mix(in srgb, var(--accent) 6%, transparent)"
          stroke="color-mix(in srgb, var(--accent) 45%, transparent)"
          strokeWidth={2}
        />
        <text
          x={circle.cx}
          y={layout.titleY}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={12}
          fontWeight={700}
          fill="var(--text)"
        >
          {circle.title}
        </text>
        <DiagramEdges edges={layout.edges} focus={focus} uid={uid} />
      </svg>
      {layout.sections.map((s) => (
        <DiagramSectionHeader
          key={s.id}
          section={s}
          open={addOpen === s.id}
          onAdd={() => onAdd(s.id)}
        />
      ))}
      {layout.nodes.map((n) => (
        <DiagramNodeView
          key={n.id}
          node={n}
          opacity={nodeOpacity(n, focus, layout.edges)}
          open={
            n.id === openId ||
            (n.kind === 'origin' && `schema:${n.schemaId}` === openId)
          }
          pressed={n.id === pressedId}
          onTap={() => tap(n)}
        />
      ))}
      {panelAt && (
        <div
          data-export-skip
          style={{
            position: 'absolute',
            zIndex: 5,
            top: panelAt.y + HEAD_H - 4,
            width: panelW,
            left: layout.wide
              ? Math.max(
                  PANEL_MARGIN,
                  Math.min(panelAt.x, layout.width - panelW - PANEL_MARGIN),
                )
              : PANEL_MARGIN,
          }}
        >
          {panel}
        </div>
      )}
    </div>
  );
}
