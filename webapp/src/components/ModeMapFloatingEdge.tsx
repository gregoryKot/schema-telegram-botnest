import {
  BaseEdge, EdgeLabelRenderer, useInternalNode, getBezierPath,
  Position, type EdgeProps, type InternalNode, type Node,
} from '@xyflow/react';

// ── Geometry: exact point where the border faces the other node ───────────────
// Ellipse for the round Child node, bounding box for everything else. The arrow
// ends right ON the border (1px inset) → no gap, no overlap into the shape.
function getNodeIntersection(node: InternalNode<Node>, other: InternalNode<Node>) {
  const w = (node.measured.width ?? 0) / 2;
  const h = (node.measured.height ?? 0) / 2;
  const cx = node.internals.positionAbsolute.x + w;
  const cy = node.internals.positionAbsolute.y + h;
  const ox = other.internals.positionAbsolute.x + (other.measured.width ?? 0) / 2;
  const oy = other.internals.positionAbsolute.y + (other.measured.height ?? 0) / 2;

  if (w === 0 || h === 0) return { x: cx, y: cy };

  const dx = ox - cx, dy = oy - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };

  // Ellipse (Child): true ellipse boundary in the direction of the other node.
  if (node.type === 'child') {
    const a = w - 1, b = h - 1;
    const t = 1 / Math.sqrt((dx / a) ** 2 + (dy / b) ** 2);
    return { x: cx + dx * t, y: cy + dy * t };
  }

  // Rect / polygon: hit the nearest bounding-box edge in that direction.
  const a = w - 1, b = h - 1;
  const t = Math.min(a / (Math.abs(dx) || 1e-6), b / (Math.abs(dy) || 1e-6));
  return { x: cx + dx * t, y: cy + dy * t };
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
