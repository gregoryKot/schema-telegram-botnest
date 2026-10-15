// Рёбра диаграммы — только из данных терапевта, ничего не дорисовывается:
//   link   режим ⇄ схема (режим включает схему)         серая, стрелки с обеих сторон
//   origin овал опыта → его схема                       серая
//   blocks схема → таблетка потребности, посередине ✗   красная
//   meets  Здоровый Взрослый → таблетка, посередине ✓   зелёная
import type { ConceptGraphModel } from '../conceptGraphTypes';
import { center, collect } from './diagramLinks';
import { smooth, smoothSide, type Rect } from './diagramCurves';
import type { CircleGeometry } from './diagramCircle';
import { laneRoute, laneXs, type LaneItem } from './diagramLanes';
import { narrowColumn } from './diagramNarrow';
import { assignPorts, type End } from './diagramPortAssign';
import { badgePoint } from './diagramPolyline';
import {
  bandOf,
  routeNeed,
  type NeedCtx,
  type NeedKind,
} from './diagramNeedRoutes';
import type {
  DiagramEdge,
  DiagramEdgeKind,
  DiagramNode,
  Pt,
} from './diagramTypes';

const STYLE: Record<DiagramEdgeKind, { color: string; opacity: number }> = {
  link: { color: 'var(--text-sub)', opacity: 0.75 },
  origin: { color: 'var(--text-sub)', opacity: 0.7 },
  blocks: { color: 'var(--accent-red)', opacity: 0.7 },
  meets: { color: 'var(--accent-green)', opacity: 0.8 },
};

export function buildEdges(
  graph: ConceptGraphModel,
  nodes: DiagramNode[],
  geometry: CircleGeometry,
  wide: boolean,
  width: number,
): DiagramEdge[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const ctx: NeedCtx = { circle: geometry.circle, bands: geometry.bands, wide };
  const links = collect(graph, byId, ctx);
  const ends: End[] = links.flatMap((l) => [
    { node: l.from, side: l.sides[0], other: center(l.to) },
    { node: l.to, side: l.sides[1], other: center(l.from) },
  ]);
  const ports = assignPorts(ends);
  const pair = (i: number): [Pt, Pt] => [ports[2 * i], ports[2 * i + 1]];

  // Узкий вид: x дорожки для каждой линии, кроме короткой стрелки «опыт → схема».
  const laneIdx = links
    .map((l, i) => (l.kind === 'origin' ? -1 : i))
    .filter((i) => i >= 0);
  const items: LaneItem[] = laneIdx.map((i) => ({
    s: pair(i)[0],
    t: pair(i)[1],
    side: links[i].sides[0] as 'left' | 'right',
  }));
  const xs = wide ? [] : laneXs(items, narrowColumn(width));
  const lanes: Record<NeedKind, number> = { blocks: 0, meets: 0 };
  // Линии, входящие в таблетки по одному просвету между рядами, делят его поровну.
  const inBand = [0, 1].map((b) =>
    links.filter(
      (l) =>
        l.kind !== 'link' && l.kind !== 'origin' && bandOf(l.sides[1]) === b,
    ),
  );
  const taken: Pt[] = [];

  return links.map((l, i): DiagramEdge => {
    const [s, t] = pair(i);
    const obstacles: Rect[] = nodes.filter((n) => n !== l.from && n !== l.to);
    let points: Pt[];
    if (l.kind === 'origin') points = smooth(s, t);
    else if (!wide) points = laneRoute(s, t, xs[laneIdx.indexOf(i)]);
    else if (l.kind === 'link') points = smoothSide(s, t);
    else {
      const b = bandOf(l.sides[1]);
      const slot =
        b === null
          ? { k: 0, n: 1 }
          : { k: inBand[b].indexOf(l), n: inBand[b].length };
      points = routeNeed(
        l.kind,
        s,
        t,
        l.sides[1],
        ctx,
        lanes[l.kind]++,
        slot,
        obstacles,
      );
    }
    const needEdge = l.kind === 'blocks' || l.kind === 'meets';
    const badgeAt = needEdge ? badgePoint(points, obstacles, taken) : undefined;
    if (badgeAt) taken.push(badgeAt);
    return {
      id: `${l.kind}:${l.from.id}>${l.to.id}`,
      from: l.from.id,
      to: l.to.id,
      kind: l.kind,
      points,
      ...STYLE[l.kind],
      both: l.kind === 'link',
      badge: badgeAt
        ? { at: badgeAt, kind: l.kind === 'blocks' ? 'block' : 'meet' }
        : undefined,
    };
  });
}
