// Раскладка диаграммы концептуализации: чистая функция от модели графа и
// ширины. Круг базовых потребностей в центре; слева схемы (убеждение и опыт) и
// ещё левее режимы; справа Здоровый Взрослый. Линии — только из данных: режим
// ⇄ схема, опыт → схема, ✗ схема → потребность, ✓ здоровый режим → потребность.
import type { ConceptGraphModel } from '../conceptGraphTypes';
import { buildEdges } from './diagramEdges';
import { layoutNarrow } from './diagramNarrow';
import { layoutWide } from './diagramWide';
import { WIDE_MIN, type DiagramLayout } from './diagramTypes';

/**
 * Уже этого раскладка не сужается: круг потребностей (ширина − 32) не может быть
 * меньше 288, иначе «Привязанность» не влезает в таблетку.
 */
export const MIN_WIDTH = 320;

export function layoutConceptDiagram(
  graph: ConceptGraphModel,
  width: number,
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
    nodes: geo.nodes,
    edges: buildEdges(graph, geo.nodes, geo.geometry, wide, W),
  };
}
