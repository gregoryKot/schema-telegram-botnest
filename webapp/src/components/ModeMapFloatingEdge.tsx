import {
  BaseEdge, EdgeLabelRenderer, useInternalNode, getStraightPath, useReactFlow,
  type EdgeProps,
} from '@xyflow/react';
import { getEdgeParams } from './modeMap/edgeGeometry';
import { edgeLabelStyle } from './modeMap/edgeLabel';

// ── Floating edge — clean straight line between the two shape borders ──────────
export function FloatingEdge({ id, source, target, selected, markerEnd, markerStart, style, label, labelStyle }: EdgeProps) {
  const rf = useReactFlow();
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  if (!sourceNode || !targetNode) return null;

  const { sx, sy, tx, ty } = getEdgeParams(sourceNode, targetNode);

  const [path, labelX, labelY] = getStraightPath({
    sourceX: sx, sourceY: sy, targetX: tx, targetY: ty,
  });

  // Selected → highlight the line so it's obvious it's picked (like a node ring)
  const base = (style ?? {}) as React.CSSProperties;
  const lineStyle: React.CSSProperties = selected
    ? { ...base, stroke: 'var(--accent)', strokeWidth: (Number(base.strokeWidth) || 2.5) + 1.2 }
    : base;

  // Custom reconnect: drag an endpoint dot onto another node (built-in anchors sit on
  // the handle, not on our floating endpoint, so they're un-grabbable here).
  const startReconnect = (end: 'source' | 'target') => (e: React.PointerEvent) => {
    e.stopPropagation();
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointerup', onUp, true);
      const fp = rf.screenToFlowPosition({ x: ev.clientX, y: ev.clientY });
      const hit = rf.getIntersectingNodes({ x: fp.x - 2, y: fp.y - 2, width: 4, height: 4 });
      const node = hit[hit.length - 1];
      const fixed = end === 'source' ? target : source;
      if (node && node.id !== fixed) {
        window.dispatchEvent(new CustomEvent('modemap-reconnect', { detail: { id, end, nodeId: node.id } }));
      }
    };
    window.addEventListener('pointerup', onUp, true);
  };

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} markerStart={markerStart} style={lineStyle} interactionWidth={26} />
      <EdgeLabelRenderer>
        {selected && ([['source', sx, sy], ['target', tx, ty]] as const).map(([end, x, y]) => (
          <div key={end} className="nodrag nopan" onPointerDown={startReconnect(end)}
            title="Перетащи на другой режим"
            style={{ position: 'absolute', transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
              width: 13, height: 13, borderRadius: '50%', background: 'var(--bg-elev)',
              border: '2.5px solid var(--accent)', cursor: 'grab', pointerEvents: 'all', zIndex: 11 }} />
        ))}
        {label && (
          <div style={{ ...edgeLabelStyle(label, base.stroke, labelStyle as React.CSSProperties),
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}>
            {label as string}
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
}
