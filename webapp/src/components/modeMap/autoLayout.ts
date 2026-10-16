import Dagre from '@dagrejs/dagre';
import type { Node, Edge } from '@xyflow/react';
import { NODE_DEFAULT_SIZES } from '../modeMapData';
import { HUB_DIAMETER, nodesInsideHub } from './hubGeometry';

type FlowNode = Node<Record<string, unknown>>;
type FlowEdge = Edge<Record<string, unknown>>;

const diameterOf = (n: FlowNode) => (n.data as { diameter?: number } | undefined)?.diameter ?? HUB_DIAMETER;

function sizeOf(n: FlowNode): { width: number; height: number } {
  if (n.type === 'needs') return { width: diameterOf(n), height: diameterOf(n) };
  const def = NODE_DEFAULT_SIZES[n.type ?? ''];
  return {
    width: (n.width as number) ?? n.measured?.width ?? def?.width ?? 150,
    height: (n.height as number) ?? n.measured?.height ?? def?.height ?? 70,
  };
}

// ── Auto-layout via dagre ─────────────────────────────────────────────────────
// Круг потребностей вместе с тем, что внутри него, раскладывается одним блоком:
// dagre видит только круг, линии к потребностям считаются линиями к кругу, а
// потребности после раскладки едут за кругом с тем же смещением. Иначе dagre
// расставлял бы пять таблеток по рангам, и круг остался бы пустым.
export function autoLayout(nodes: FlowNode[], edges: FlowEdge[]): FlowNode[] {
  const owner = new Map<string, FlowNode>();
  for (const hub of nodes.filter((n) => n.type === 'needs')) {
    for (const inner of nodesInsideHub(hub, nodes)) if (!owner.has(inner.id)) owner.set(inner.id, hub);
  }
  const rep = (id: string) => owner.get(id)?.id ?? id;

  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', nodesep: 70, ranksep: 110, marginx: 40, marginy: 40 });
  nodes.filter((n) => !owner.has(n.id)).forEach((n) => g.setNode(n.id, sizeOf(n)));
  edges.forEach((e) => {
    const s = rep(e.source), t = rep(e.target);
    if (s !== t && g.hasNode(s) && g.hasNode(t)) g.setEdge(s, t);
  });

  Dagre.layout(g);

  const placed = (n: FlowNode) => {
    const p = g.node(n.id);
    return p ? { x: p.x - p.width / 2, y: p.y - p.height / 2 } : n.position;
  };
  return nodes.map((n) => {
    const hub = owner.get(n.id);
    if (!hub) return { ...n, position: placed(n) };
    const to = placed(hub);
    return { ...n, position: { x: n.position.x + to.x - hub.position.x, y: n.position.y + to.y - hub.position.y } };
  });
}
