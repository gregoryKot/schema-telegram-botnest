import {
  BaseEdge, EdgeLabelRenderer, useInternalNode, getBezierPath,
  Position, type EdgeProps, type InternalNode, type Node,
} from '@xyflow/react';

// ── Geometry: exact point where the REAL shape outline faces the other node ───
// Each shape's actual contour (matching its SVG path) is intersected, so arrows
// touch the visible edge — not the bounding box — for every figure.
// Normalized polygons (0..1 of the node box), matching the SVG paths.
const SHAPE_POLY: Record<string, [number, number][]> = {
  critic: [[0.293, 0], [0.707, 0], [1, 0.293], [1, 0.707], [0.707, 1], [0.293, 1], [0, 0.707], [0, 0.293]],
  pentagon: [[0.5, 0.02], [0.976, 0.366], [0.794, 0.924], [0.206, 0.924], [0.024, 0.366]],
  shield: [[0.04, 0.04], [0.96, 0.04], [0.96, 0.62], [0.73, 0.80], [0.5, 0.96], [0.27, 0.80], [0.04, 0.62]],
  behavior: [[0.02, 0.02], [0.80, 0.02], [0.98, 0.5], [0.80, 0.98], [0.02, 0.98]],
  // Cloud outline (path is viewBox 100×60 → x/100, y/60)
  trigger: [[0.18, 0.867], [0.04, 0.667], [0.13, 0.467], [0.21, 0.267], [0.33, 0.133],
    [0.46, 0.10], [0.60, 0.083], [0.76, 0.167], [0.92, 0.333], [1.0, 0.55], [0.90, 0.783], [0.82, 0.867]],
};

function polyFor(node: InternalNode<Node>): [number, number][] | null {
  if (node.type === 'critic') return SHAPE_POLY.critic;
  if (node.type === 'behavior') return SHAPE_POLY.behavior;
  if (node.type === 'trigger') return SHAPE_POLY.trigger;
  if (node.type === 'coping') {
    const sub = (node.data as { copingSubtype?: string } | undefined)?.copingSubtype ?? 'over';
    if (sub === 'over') return SHAPE_POLY.pentagon;
    if (sub === 'avoid') return SHAPE_POLY.shield;
  }
  return null; // child → ellipse, rect/pill → box
}

// Nearest exit point of the ray (cx,cy)+t·(dx,dy), t>0, through a polygon (actual coords).
function rayPolygon(cx: number, cy: number, dx: number, dy: number, pts: [number, number][]) {
  let best = Infinity, res: { x: number; y: number } | null = null;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    const ex = x2 - x1, ey = y2 - y1;
    const det = ex * dy - dx * ey;
    if (Math.abs(det) < 1e-9) continue;
    const t = (-(x1 - cx) * ey + ex * (y1 - cy)) / det;
    const u = (dx * (y1 - cy) - dy * (x1 - cx)) / det;
    if (t > 1e-6 && u >= -1e-6 && u <= 1 + 1e-6 && t < best) { best = t; res = { x: cx + dx * t, y: cy + dy * t }; }
  }
  return res;
}

function getNodeIntersection(node: InternalNode<Node>, other: InternalNode<Node>) {
  const W = node.measured.width ?? 0, H = node.measured.height ?? 0;
  const w = W / 2, h = H / 2;
  const left = node.internals.positionAbsolute.x, top = node.internals.positionAbsolute.y;
  const cx = left + w, cy = top + h;
  const ox = other.internals.positionAbsolute.x + (other.measured.width ?? 0) / 2;
  const oy = other.internals.positionAbsolute.y + (other.measured.height ?? 0) / 2;

  if (w === 0 || h === 0) return { x: cx, y: cy };
  let dx = ox - cx, dy = oy - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const len = Math.hypot(dx, dy);

  let p: { x: number; y: number };
  const poly = polyFor(node);
  if (poly) {
    // Intersect the true polygon (in absolute coords)
    const abs = poly.map(([nx, ny]) => [left + nx * W, top + ny * H] as [number, number]);
    p = rayPolygon(cx, cy, dx, dy, abs) ?? { x: cx, y: cy };
  } else if (node.type === 'child') {
    // Ellipse boundary
    const a = w, b = h;
    const t = 1 / Math.sqrt((dx / a) ** 2 + (dy / b) ** 2);
    p = { x: cx + dx * t, y: cy + dy * t };
  } else {
    // Bounding box (rect / trigger / pill)
    const t = Math.min(w / (Math.abs(dx) || 1e-6), h / (Math.abs(dy) || 1e-6));
    p = { x: cx + dx * t, y: cy + dy * t };
  }
  // Pull 1px back toward the centre so the stroke sits flush on the border (no hairline gap/overlap)
  return { x: p.x - (dx / len) * 1, y: p.y - (dy / len) * 1 };
}

// Which side the endpoint leaves from — derived from its direction off the centre,
// so it works for polygon points sitting on a diagonal edge too.
function getEdgePosition(node: InternalNode<Node>, p: { x: number; y: number }): Position {
  const cx = node.internals.positionAbsolute.x + (node.measured.width ?? 0) / 2;
  const cy = node.internals.positionAbsolute.y + (node.measured.height ?? 0) / 2;
  const dx = p.x - cx, dy = p.y - cy;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? Position.Right : Position.Left;
  return dy > 0 ? Position.Bottom : Position.Top;
}

function getEdgeParams(source: InternalNode<Node>, target: InternalNode<Node>) {
  const sp = getNodeIntersection(source, target);
  const tp = getNodeIntersection(target, source);
  return {
    sx: sp.x, sy: sp.y, tx: tp.x, ty: tp.y,
    sourcePos: getEdgePosition(source, sp),
    targetPos: getEdgePosition(target, tp),
  };
}

// ── Floating edge — clean bezier that attaches to the border facing the other node
export function FloatingEdge({ id, source, target, markerEnd, markerStart, style, label, labelStyle }: EdgeProps) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  if (!sourceNode || !targetNode) return null;

  const { sx, sy, tx, ty, sourcePos, targetPos } = getEdgeParams(sourceNode, targetNode);

  const [path, labelX, labelY] = getBezierPath({
    sourceX: sx, sourceY: sy, sourcePosition: sourcePos,
    targetX: tx, targetY: ty, targetPosition: targetPos,
    curvature: 0.22,
  });

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} markerStart={markerStart} style={style} />
      {label && (
        <EdgeLabelRenderer>
          <div style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            background: 'var(--bg-elev)', padding: '2px 7px', borderRadius: 5,
            border: '1px solid rgba(var(--fg-rgb),0.08)',
            fontSize: 11, color: 'var(--text-sub)', pointerEvents: 'all', whiteSpace: 'nowrap',
            ...(labelStyle as React.CSSProperties),
          }}>
            {label as string}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const EDGE_TYPES = { floating: FloatingEdge };
