// Зоны диаграммы: каждая собирает свои фигуры и ставит их рядами. Координаты y
// считаются от верха содержимого зоны; сдвиг по странице делает раскладка.
import type { ConceptGraphModel } from '../conceptGraphTypes';
import { fitWidth } from './diagramFlow';
import { byBarycenter, linkIndex } from './diagramLinks';
import { needNode, schemaNode, textNode } from './diagramNodes';
import { SIZE, type DiagramNode } from './diagramTypes';
import {
  MIN_SCHEMA_W,
  flowZone,
  laneNodes,
  type ZoneOut,
} from './diagramZoneKit';

export function healthyZone(graph: ConceptGraphModel, avail: number): ZoneOut {
  const nodes = laneNodes(graph, 'healthy', avail);
  if (graph.goals) {
    nodes.push(
      textNode(
        'goals',
        'goals',
        'Цели терапии',
        graph.goals,
        nodes[0].color,
        avail,
      ),
    );
  }
  return flowZone(nodes, avail) as ZoneOut;
}

export function rootsZone(
  graph: ConceptGraphModel,
  avail: number,
  modeCx: Map<string, number>,
): ZoneOut | null {
  const { roots } = graph;
  const color = 'var(--accent-yellow)';
  const nodes: DiagramNode[] = [];
  if (roots.experience) {
    nodes.push(
      textNode(
        'experience',
        'experience',
        'Ранний опыт',
        roots.experience,
        color,
        avail,
      ),
    );
  }
  // Текст «неудовлетворённые потребности» терапевт набрал руками — он остаётся
  // на схеме отдельной фигурой, а не пропадает из картины.
  if (roots.unmetNeeds) {
    nodes.push(
      textNode(
        'unmet',
        'experience',
        'Неудовлетворённые потребности',
        roots.unmetNeeds,
        color,
        avail,
      ),
    );
  }
  const needs = byBarycenter(
    roots.needs,
    (n) => n.id,
    linkIndex(graph).needs,
    modeCx,
  );
  nodes.push(...needs.map(needNode));
  return flowZone(nodes, avail);
}

export function schemasZone(
  graph: ConceptGraphModel,
  avail: number,
  modeCx: Map<string, number>,
): ZoneOut | null {
  // Схемы концептуализации плюс те, что привязаны к режимам, но в
  // концептуализации не отмечены: линия без фигуры-начала была бы обманом.
  const byId = new Map(graph.roots.schemas.map((s) => [s.id, s]));
  for (const card of Object.values(graph.lanes).flat()) {
    for (const s of card.schemas) if (!byId.has(s.id)) byId.set(s.id, s);
  }
  const chips = byBarycenter(
    [...byId.values()],
    (s) => s.id,
    linkIndex(graph).schemas,
    modeCx,
  );
  const w = fitWidth(SIZE.schema.w, MIN_SCHEMA_W, avail);
  return flowZone(
    chips.map((c) => schemaNode(c, w)),
    avail,
  );
}

export function copingZone(graph: ConceptGraphModel, avail: number): ZoneOut {
  return flowZone(laneNodes(graph, 'coping', avail), avail) as ZoneOut;
}

export function costZone(
  graph: ConceptGraphModel,
  avail: number,
): ZoneOut | null {
  if (!graph.problems) return null;
  return flowZone(
    [
      textNode(
        'problems',
        'problems',
        'Проблемы сейчас',
        graph.problems,
        'var(--accent-red)',
        avail,
      ),
    ],
    avail,
  );
}
