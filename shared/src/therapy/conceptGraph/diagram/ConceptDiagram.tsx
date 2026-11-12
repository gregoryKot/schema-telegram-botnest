import { useId, useState, type ReactNode } from 'react';
import type { ConceptGraphModel } from '../conceptGraphTypes';
import { DiagramEdges } from './DiagramEdges';
import { DiagramNeedsCircle } from './DiagramNeedsCircle';
import { DiagramNodeView } from './DiagramNodeView';
import { DiagramPeriodSwitch } from './DiagramPeriodSwitch';
import { DiagramSectionHeader } from './DiagramSectionHeader';
import { nodeOpacity, resolveFocus } from './diagramFocus';
import { layoutConceptDiagram } from './diagramLayout';
import { defaultNeedPeriod, type NeedPeriod } from './diagramNeedPct';
import { HEAD_H } from './diagramSections';
import type { AddSection, DiagramNode } from './diagramTypes';
import { useContainerWidth } from './useContainerWidth';

const PANEL_W = 380;
const PANEL_MARGIN = 8;

/**
 * Диаграмма случая: круг базовых потребностей в центре, слева схемы с
 * убеждением и опытом и ещё левее режимы, справа Здоровый Взрослый. Режим и
 * схема открывают свои редакторы, потребность включает подсветку своих линий
 * (✗ и ✓), заготовка пустой секции и «+» в заголовке зовут выбор. Таблетки
 * потребностей показывают проценты колеса (`graph.needLinks`) за период,
 * выбранный над подписью круга; выбор живёт здесь и не сохраняется.
 *
 * Без `edit` — только чтение (схема у клиента, ConceptGraphView): «+» нет,
 * заготовка не нажимается, а тап по любой фигуре подсвечивает её линии, как у
 * потребности. Рисование одно на оба вида — копии раскладки нет.
 */
export function ConceptDiagram({
  graph,
  edit,
}: {
  graph: ConceptGraphModel;
  edit?: {
    /** Открытый редактор: `mode:<id>` или `schema:<id>`. */
    openId: string | null;
    /** Секция, у которой сейчас открыт выбор («+ режим», «+ схема»). */
    addOpen: AddSection | null;
    /** Содержимое выбора; рисуется под заголовком открытой секции. */
    panel: ReactNode;
    onOpenMode: (modeId: string) => void;
    onOpenSchema: (schemaId: string) => void;
    onAdd: (section: AddSection) => void;
  };
}) {
  const openId = edit?.openId ?? null;
  const addOpen = edit?.addOpen ?? null;
  const [ref, width] = useContainerWidth();
  const uid = useId().replace(/:/g, '');
  const [pressedId, setPressedId] = useState<string | null>(null);
  const [picked, setPeriod] = useState<NeedPeriod | null>(null);
  const period = picked ?? defaultNeedPeriod(graph.needLinks);
  const layout = layoutConceptDiagram(graph, width, period);
  const focus = resolveFocus(layout, pressedId, openId);
  const panelAt = layout.sections.find((s) => s.id === addOpen);
  const panelW = layout.wide ? PANEL_W : layout.width - 2 * PANEL_MARGIN;

  const tap = (n: DiagramNode) => {
    if (n.kind === 'need' || !edit) {
      setPressedId((cur) => (cur === n.id ? null : n.id));
      return;
    }
    setPressedId(null);
    if (n.kind === 'mode' && n.modeId) edit.onOpenMode(n.modeId);
    else if ((n.kind === 'schema' || n.kind === 'origin') && n.schemaId) {
      edit.onOpenSchema(n.schemaId);
    } else if (n.kind === 'placeholder' && n.section !== 'needs')
      edit.onAdd(n.section);
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
        <DiagramNeedsCircle circle={layout.circle} titleY={layout.titleY} />
        <DiagramEdges edges={layout.edges} focus={focus} uid={uid} />
      </svg>
      {layout.sections.map((s) => (
        <DiagramSectionHeader
          key={s.id}
          section={s}
          open={addOpen === s.id}
          onAdd={edit && (() => edit.onAdd(s.id))}
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
          onTap={edit || n.kind !== 'placeholder' ? () => tap(n) : undefined}
          readOnly={!edit}
        />
      ))}
      <DiagramPeriodSwitch
        layout={layout}
        links={graph.needLinks}
        period={period}
        onPeriod={setPeriod}
      />
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
          {edit?.panel}
        </div>
      )}
    </div>
  );
}
