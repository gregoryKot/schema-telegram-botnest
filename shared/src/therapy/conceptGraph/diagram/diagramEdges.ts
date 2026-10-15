// Линии «питает»: схема → режим и потребность → режим. Каждой фигуре линии
// расходятся веером по её стороне (порядок — по x другого конца), чтобы у
// режима с тремя схемами стрелки не слипались в одну точку.
import type { ConceptGraphModel } from '../conceptGraphTypes';
import { clusterEdges } from './diagramClusterEdges';
import { portPoint, spreadU, type Side } from './diagramPorts';
import { routeVertical, type Lane, type Rect } from './diagramRoute';
import type { DiagramBand, DiagramEdge, DiagramNode, Pt } from './diagramTypes';

interface Link {
  from: DiagramNode;
  to: DiagramNode;
  kind: 'feeds' | 'need';
  color: string;
}

const NEED_COLOR = 'var(--text-faint)';
const FEEDS_OPACITY = 0.5;
const NEED_OPACITY = 0.6;

function links(
  graph: ConceptGraphModel,
  byId: Map<string, DiagramNode>,
): Link[] {
  const out: Link[] = [];
  for (const card of Object.values(graph.lanes).flat()) {
    const to = byId.get(`mode:${card.modeId}`);
    if (!to) continue;
    for (const s of card.schemas) {
      const from = byId.get(`schema:${s.id}`);
      if (from) out.push({ from, to, kind: 'feeds', color: s.color });
    }
    for (const n of card.needs) {
      const from = byId.get(`need:${n.id}`);
      if (from) out.push({ from, to, kind: 'need', color: NEED_COLOR });
    }
  }
  return out;
}

interface End {
  link: number;
  end: 0 | 1;
}

const cx = (n: DiagramNode) => n.x + n.w / 2;

/** Кто выше: стрелка идёт вниз, если цель под источником. */
const goesDown = (l: Link) => l.to.y >= l.from.y + l.from.h;

export function buildEdges(
  graph: ConceptGraphModel,
  nodes: DiagramNode[],
  bands: DiagramBand[],
  width: number,
): DiagramEdge[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const all = links(graph, byId);

  // Доля стороны для каждого конца линии: у фигуры линии идут веером в порядке
  // x другого конца.
  const sides = all.map((l): [Side, Side] =>
    goesDown(l) ? ['bottom', 'top'] : ['top', 'bottom'],
  );
  const groups = new Map<
    string,
    { node: DiagramNode; side: Side; ends: End[] }
  >();
  all.forEach((l, i) => {
    for (const end of [0, 1] as const) {
      const node = end === 0 ? l.from : l.to;
      const side = sides[i][end];
      const g = groups.get(`${node.id}:${side}`) ?? { node, side, ends: [] };
      g.ends.push({ link: i, end });
      groups.set(`${node.id}:${side}`, g);
    }
  });
  const ends = all.map((): [number, number] => [0.5, 0.5]);
  for (const g of groups.values()) {
    const otherX = (e: End) =>
      cx(e.end === 0 ? all[e.link].to : all[e.link].from);
    g.ends
      .sort((a, b) => otherX(a) - otherX(b))
      .forEach((e, k) => {
        ends[e.link][e.end] = spreadU(g.node.shape, g.side, k, g.ends.length);
      });
  }

  const taken: Lane[] = [];
  const edges = all.map((l, i): DiagramEdge => {
    const s: Pt = portPoint(l.from, sides[i][0], ends[i][0]);
    const t: Pt = portPoint(l.to, sides[i][1], ends[i][1]);
    const obstacles: Rect[] = nodes.filter((n) => n !== l.from && n !== l.to);
    return {
      id: `${l.kind}:${l.from.id}>${l.to.id}`,
      from: l.from.id,
      to: l.to.id,
      kind: l.kind,
      points: routeVertical(s, t, obstacles, width, taken),
      color: l.color,
      opacity: l.kind === 'feeds' ? FEEDS_OPACITY : NEED_OPACITY,
      dashed: l.kind === 'need',
    };
  });
  return [...edges, ...clusterEdges(nodes, width, bands, taken)];
}
