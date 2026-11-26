// Раскладка диаграммы концептуализации: чистая функция от модели графа, ширины
// и периода колеса (проценты на таблетках). Круг потребностей в центре; слева
// схемы (убеждение и опыт), левее режимы; справа Здоровый Взрослый. Линии — из
// данных: режим ⇄ схема, опыт → схема, ✗ схема и ✓ здоровый режим → потребность.
import type { ConceptGraphModel } from '../conceptGraphTypes';
import { buildEdges } from './diagramEdgesModel';
import { layoutNarrow } from './diagramNarrow';
import { rateNeedNodes, type NeedPeriod } from './diagramNeedPct';
import { layoutWide } from './diagramWide';
import { WIDE_MIN, type DiagramLayout } from './diagramTypes';

// Уже этого раскладка не сужается: круг потребностей (ширина − 32) не может быть
// меньше 288, иначе «Привязанность» не влезает в таблетку.
export const MIN_WIDTH = 320;

export function layoutConceptDiagram(
  graph: ConceptGraphModel,
  width: number,
  period?: NeedPeriod,
): DiagramLayout {
  const W = Math.max(width, MIN_WIDTH);
  const wide = W >= WIDE_MIN;
  const geo = wide ? layoutWide(graph, W) : layoutNarrow(graph, W);
  return {
    width: W,
    height: geo.height,
    wide,
    sections: geo.sections,
    circle: geo.geometry.circle,
    titleY: geo.geometry.titleY,
    nodes: rateNeedNodes(geo.nodes, graph.needLinks, period),
    edges: buildEdges(graph, geo.nodes, geo.geometry, wide, W),
  };
}
