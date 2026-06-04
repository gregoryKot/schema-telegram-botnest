import { MarkerType, type Node, type Edge } from '@xyflow/react';
import type { ModeMapNode, ModeMapEdge } from '../api';

export type FlowNode = Node<Record<string, unknown>>;
export type FlowEdge = Edge<Record<string, unknown>>;

export function edgeColor(d?: ModeMapEdge['data']): string {
  // Colour is set explicitly by the user; the connection type only drives the
  // text label now (not the colour). Neutral grey is the default.
  if (d?.color) return d.color;
  return 'rgba(var(--fg-rgb),0.45)';
}

export const EDGE_WIDTH_PX: Record<string, number> = { thin: 2, normal: 3, bold: 4.5 };

export function makeMarker(color: string, width?: string) {
  const s = (EDGE_WIDTH_PX[width ?? 'normal'] ?? 3);
  const m = 13 + s * 1.5;  // arrowhead grows with line thickness
  return { type: MarkerType.ArrowClosed, color, width: m, height: m };
}

function dashArray(style?: string): string | undefined {
  if (style === 'dashed') return '7 5';
  if (style === 'dotted') return '1.5 5';
  return undefined; // solid
}

export function edgeStyle(color: string, lineStyle?: string, width?: string): React.CSSProperties {
  const w = EDGE_WIDTH_PX[width ?? 'normal'] ?? 3;
  return { stroke: color, strokeWidth: w, strokeDasharray: dashArray(lineStyle), strokeLinecap: 'round' };
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
      style: edgeStyle(color, d?.lineStyle, d?.width),
      markerEnd: makeMarker(color, d?.width),
      markerStart: d?.bidirectional ? makeMarker(color, d?.width) : undefined,
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
