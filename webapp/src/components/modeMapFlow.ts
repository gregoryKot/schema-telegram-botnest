import { MarkerType, type Node, type Edge } from '@xyflow/react';
import type { ModeMapNode, ModeMapEdge } from '../api';

export type FlowNode = Node<Record<string, unknown>>;
export type FlowEdge = Edge<Record<string, unknown>>;

export function edgeColor(d?: ModeMapEdge['data']): string {
  if (d?.color) return d.color;            // explicit user color wins
  const t = d?.edgeType;
  if (t === 'suppresses') return 'var(--accent-red)';
  if (t === 'protects')   return 'var(--accent-green)';
  if (t === 'leads_to')   return 'var(--accent-orange)';
  return 'rgba(var(--fg-rgb),0.45)';
}

export function makeMarker(color: string) {
  return { type: MarkerType.ArrowClosed, color, width: 16, height: 16 };
}

function dashArray(style?: string): string | undefined {
  if (style === 'dashed') return '7 5';
  if (style === 'dotted') return '1.5 5';
  return undefined; // solid
}

export function edgeStyle(color: string, lineStyle?: string): React.CSSProperties {
  return { stroke: color, strokeWidth: 2, strokeDasharray: dashArray(lineStyle), strokeLinecap: 'round' };
}

export function toFlowEdges(edges: ModeMapEdge[]): FlowEdge[] {
  return edges.map(e => {
    const d = e.data as ModeMapEdge['data'];
    const color = edgeColor(d);
    return {
      id: e.id, source: e.source, target: e.target,
      sourceHandle: e.sourceHandle ?? undefined,
      targetHandle: e.targetHandle ?? undefined,
      label: e.label || undefined,
      data: e.data as Record<string, unknown>,
      type: 'floating',
      style: edgeStyle(color, d?.lineStyle),
      markerEnd: makeMarker(color),
      markerStart: d?.bidirectional ? makeMarker(color) : undefined,
      ...(e.label ? { labelStyle: { fontSize: 11, fill: 'var(--text-sub)' }, labelBgStyle: { fill: 'var(--bg-elev)', fillOpacity: 0.85 } } : {}),
    };
  });
}

export function toFlowNodes(nodes: ModeMapNode[]): FlowNode[] {
  return nodes.map(n => ({
    id: n.id, type: n.type, position: n.position,
    data: n.data as Record<string, unknown>,
    ...(n.width  ? { width:  n.width  } : {}),
    ...(n.height ? { height: n.height } : {}),
  }));
}

export function fromFlowNodes(nodes: FlowNode[]): ModeMapNode[] {
  return nodes.map(n => ({
    id: n.id, type: n.type as ModeMapNode['type'], position: n.position,
    data: n.data as unknown as ModeMapNode['data'],
    ...(n.width  ? { width:  n.width  } : {}),
    ...(n.height ? { height: n.height } : {}),
  }));
}

export function fromFlowEdges(edges: FlowEdge[]): ModeMapEdge[] {
  return edges.map(e => ({
    id: e.id, source: e.source, target: e.target,
    sourceHandle: e.sourceHandle ?? null,
    targetHandle: e.targetHandle ?? null,
    label: e.label as string | undefined,
    data: e.data as unknown as ModeMapEdge['data'],
  }));
}
