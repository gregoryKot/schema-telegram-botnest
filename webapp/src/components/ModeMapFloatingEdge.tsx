import {
  BaseEdge, EdgeLabelRenderer, useInternalNode,
  Position, type EdgeProps, type InternalNode, type Node,
} from '@xyflow/react';

// ── Geometry: intersection of border with the line to the other node ──────────
function getNodeIntersection(node: InternalNode<Node>, other: InternalNode<Node>) {
  const w = (node.measured.width ?? 0) / 2;
  const h = (node.measured.height ?? 0) / 2;
  const x2 = node.internals.positionAbsolute.x + w;
  const y2 = node.internals.positionAbsolute.y + h;
  const x1 = other.internals.positionAbsolute.x + (other.measured.width ?? 0) / 2;
  const y1 = other.internals.positionAbsolute.y + (other.measured.height ?? 0) / 2;

  if (w === 0 || h === 0) return { x: x2, y: y2 };

  // Circle nodes: intersect the actual circle, not the bounding box (the box
  // corners stick out → gap at diagonal angles). 1px inset so the arrow touches.
  if (node.type === 'child') {
    const r = Math.min(w, h) - 1;
    const dx = x1 - x2, dy = y1 - y2;
    const len = Math.hypot(dx, dy) || 1;
    return { x: x2 + (dx / len) * r, y: y2 + (dy / len) * r };
  }

  // Box-based shapes — intersect the bounding box, inset 1px to avoid a hairline gap.
  const iw = w - 1, ih = h - 1;
  const xx1 = (x1 - x2) / (2 * iw) - (y1 - y2) / (2 * ih);
  const yy1 = (x1 - x2) / (2 * iw) + (y1 - y2) / (2 * ih);
  const a = 1 / (Math.abs(xx1) + Math.abs(yy1) || 1);
  const xx3 = a * xx1;
  const yy3 = a * yy1;
  return { x: iw * (xx3 + yy3) + x2, y: ih * (-xx3 + yy3) + y2 };
}

function getEdgePosition(node: InternalNode<Node>, p: { x: number; y: number }): Position {
  const nx = Math.round(node.internals.positionAbsolute.x);
  const ny = Math.round(node.internals.positionAbsolute.y);
  const w = node.measured.width ?? 0;
  const h = node.measured.height ?? 0;
  const px = Math.round(p.x);
  const py = Math.round(p.y);
  if (px <= nx + 1) return Position.Left;
  if (px >= nx + w - 1) return Position.Right;
  if (py <= ny + 1) return Position.Top;
  if (py >= ny + h - 1) return Position.Bottom;
  return Position.Top;
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

function hashId(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// ── Floating edge — attaches to the border facing the other node ──────────────
export function FloatingEdge({ id, source, target, markerEnd, markerStart, style, label, labelStyle }: EdgeProps) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  if (!sourceNode || !targetNode) return null;

  const { sx, sy, tx, ty } = getEdgeParams(sourceNode, targetNode);

  // Endpoints stay ON the borders (no gap). To keep parallel / reciprocal
  // edges from merging, bow only the MIDDLE of the curve perpendicular by a
  // small id-derived offset.
  const bow = ((hashId(id) % 5) - 2) * 16; // -32 … +32
  const dx = tx - sx, dy = ty - sy;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const mx = (sx + tx) / 2 + nx * bow;
  const my = (sy + ty) / 2 + ny * bow;
  const path = `M ${sx},${sy} Q ${mx},${my} ${tx},${ty}`;
  const labelX = (sx + tx) / 2 + nx * bow * 0.5;
  const labelY = (sy + ty) / 2 + ny * bow * 0.5;

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} markerStart={markerStart} style={style} />
      {label && (
        <EdgeLabelRenderer>
          <div style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            background: 'var(--bg-elev)', padding: '1px 6px', borderRadius: 4,
            fontSize: 11, color: 'var(--text-sub)', pointerEvents: 'all',
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
