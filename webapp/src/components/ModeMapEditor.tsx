import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow, ReactFlowProvider, Background, BackgroundVariant, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState, useReactFlow,
  MarkerType,
  type Connection, type Node, type Edge, type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type { ModeMapNode, ModeMapEdge } from '../api';
import { api } from '../api';
import { NODE_TYPES } from './ModeMapNodes';
import { ModeMapPalette, DRAG_TYPE } from './ModeMapPalette';
import { ModeMapNodeEditor, ModeMapEdgeEditor } from './ModeMapNodeEditor';

type FlowNode = Node<Record<string, unknown>>;
type FlowEdge = Edge<Record<string, unknown>>;

function edgeColor(t?: string) {
  if (t === 'suppresses') return 'var(--accent-red)';
  if (t === 'protects')   return 'var(--accent-green)';
  if (t === 'leads_to')   return 'var(--accent-orange)';
  return 'rgba(var(--fg-rgb),0.45)';
}

function makeMarker(color: string) {
  return { type: MarkerType.ArrowClosed, color, width: 16, height: 16 };
}

function toFlowEdges(edges: ModeMapEdge[]): FlowEdge[] {
  return edges.map(e => {
    const et = (e.data as ModeMapEdge['data'])?.edgeType;
    const bidir = (e.data as ModeMapEdge['data'])?.bidirectional;
    const color = edgeColor(et);
    return {
      id: e.id, source: e.source, target: e.target,
      label: e.label, data: e.data as Record<string, unknown>,
      type: 'smoothstep', animated: et === 'activates',
      style: { stroke: color, strokeWidth: 2 },
      markerEnd: makeMarker(color),
      markerStart: bidir ? makeMarker(color) : undefined,
      labelStyle: { fontSize: 11, fill: 'var(--text-sub)' },
      labelBgStyle: { fill: 'var(--bg-elev)', fillOpacity: 0.85 },
    };
  });
}

function toFlowNodes(nodes: ModeMapNode[]): FlowNode[] {
  return nodes.map(n => ({
    id: n.id, type: n.type, position: n.position,
    data: n.data as Record<string, unknown>,
    ...(n.width  ? { width:  n.width  } : {}),
    ...(n.height ? { height: n.height } : {}),
  }));
}

function fromFlowNodes(nodes: FlowNode[]): ModeMapNode[] {
  return nodes.map(n => ({
    id: n.id, type: n.type as ModeMapNode['type'], position: n.position,
    data: n.data as unknown as ModeMapNode['data'],
    ...(n.width  ? { width:  n.width  } : {}),
    ...(n.height ? { height: n.height } : {}),
  }));
}

function fromFlowEdges(edges: FlowEdge[]): ModeMapEdge[] {
  return edges.map(e => ({
    id: e.id, source: e.source, target: e.target,
    label: e.label as string | undefined,
    data: e.data as unknown as ModeMapEdge['data'],
  }));
}

// ─── Inner canvas (uses useReactFlow) ────────────────────────────────────────

interface CanvasProps {
  nodes: FlowNode[]; edges: FlowEdge[];
  setNodes: ReturnType<typeof useNodesState<FlowNode>>[1];
  setEdges: ReturnType<typeof useEdgesState<FlowEdge>>[1];
  onNodesChange: ReturnType<typeof useNodesState<FlowNode>>[2];
  onEdgesChange: ReturnType<typeof useEdgesState<FlowEdge>>[2];
  setSelectedNodeId: (id: string | null) => void;
  setSelectedEdgeId: (id: string | null) => void;
  saveStatus: 'idle' | 'saving' | 'saved';
  scheduleSave: (ns: FlowNode[], es: FlowEdge[]) => void;
}

function ModeMapCanvas({ nodes, edges, setNodes, setEdges, onNodesChange, onEdgesChange,
  setSelectedNodeId, setSelectedEdgeId, saveStatus, scheduleSave }: CanvasProps) {
  const { screenToFlowPosition } = useReactFlow();

  const onConnect = useCallback((conn: Connection) => {
    const color = edgeColor('activates');
    const newEdges = addEdge({
      ...conn, type: 'smoothstep', label: 'активирует',
      data: { edgeType: 'activates' } as Record<string, unknown>,
      animated: true, style: { stroke: color, strokeWidth: 2 },
      markerEnd: makeMarker(color),
      labelStyle: { fontSize: 11, fill: 'var(--text-sub)' },
      labelBgStyle: { fill: 'var(--bg-elev)', fillOpacity: 0.85 },
    }, edges);
    setEdges(newEdges); scheduleSave(nodes, newEdges);
  }, [edges, nodes, setEdges, scheduleSave]);

  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }, []);
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData(DRAG_TYPE);
    if (!raw) return;
    try {
      const partial: Omit<ModeMapNode, 'position'> = JSON.parse(raw);
      const freshId = `${partial.data.modeId ?? 'node'}_${Date.now()}`;
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const newNodes = [...nodes, { id: freshId, type: partial.type, position, data: partial.data as Record<string, unknown> }];
      setNodes(newNodes); scheduleSave(newNodes, edges);
    } catch { /* ignore */ }
  }, [nodes, edges, setNodes, scheduleSave, screenToFlowPosition]);

  const onNodesChangeWithSave = useCallback((changes: Parameters<typeof onNodesChange>[0]) => {
    onNodesChange(changes);
    const shouldSave = changes.some(c =>
      (c.type === 'position' && !c.dragging) ||
      (c.type === 'dimensions' && c.resizing === false)
    );
    if (shouldSave) scheduleSave(nodes, edges);
  }, [onNodesChange, nodes, edges, scheduleSave]);

  return (
    <div style={{ flex: 1, position: 'relative' }}>
      <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 10, fontSize: 12, color: 'var(--text-faint)', pointerEvents: 'none' }}>
        {saveStatus === 'saving' ? 'сохраняю…' : saveStatus === 'saved' ? '✓ сохранено' : ''}
      </div>
      {nodes.length === 0 && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 5 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🗺️</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Карта режимов пуста</div>
          <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 6, textAlign: 'center', maxWidth: 260 }}>
            Кликай по режиму в панели слева или перетащи его на холст
          </div>
        </div>
      )}
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={NODE_TYPES as NodeTypes}
        onNodesChange={onNodesChangeWithSave} onEdgesChange={onEdgesChange}
        onConnect={onConnect} onDrop={onDrop} onDragOver={onDragOver}
        onNodeClick={(_, node) => { setSelectedNodeId(node.id); setSelectedEdgeId(null); }}
        onEdgeClick={(_, edge) => { setSelectedEdgeId(edge.id); setSelectedNodeId(null); }}
        onPaneClick={() => { setSelectedNodeId(null); setSelectedEdgeId(null); }}
        fitView fitViewOptions={{ padding: 0.2 }} deleteKeyCode={null}
        nodesDraggable nodeDragThreshold={1}
      >
        <Background variant={BackgroundVariant.Dots} color="rgba(var(--fg-rgb),0.18)" gap={22} size={1.5} />
        <Controls style={{ background: 'var(--bg-elev)', border: '1px solid rgba(var(--fg-rgb),0.1)' }} />
        <MiniMap style={{ background: 'var(--bg-elev)' }} nodeColor={() => 'rgba(var(--fg-rgb),0.15)'} />
      </ReactFlow>
    </div>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────

interface Props {
  mapId: number;
  initialNodes: ModeMapNode[];
  initialEdges: ModeMapEdge[];
}

export function ModeMapEditor({ mapId, initialNodes, initialEdges }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(toFlowNodes(initialNodes));
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>(toFlowEdges(initialEdges));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedNode = nodes.find(n => n.id === selectedNodeId) ?? null;
  const selectedEdge = edges.find(e => e.id === selectedEdgeId) ?? null;

  const scheduleSave = useCallback((ns: FlowNode[], es: FlowEdge[]) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveStatus('idle');
    saveTimer.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        await api.updateModeMap(mapId, { nodes: fromFlowNodes(ns), edges: fromFlowEdges(es) });
        setSaveStatus('saved');
      } catch { setSaveStatus('idle'); }
    }, 1200);
  }, [mapId]);

  const handleAddNode = useCallback((partial: Omit<ModeMapNode, 'position'>) => {
    const pos = { x: 220 + Math.random() * 280, y: 100 + Math.random() * 200 };
    const newNodes = [...nodes, { id: partial.id, type: partial.type, position: pos, data: partial.data as Record<string, unknown> }];
    setNodes(newNodes); scheduleSave(newNodes, edges);
  }, [nodes, edges, setNodes, scheduleSave]);

  const handleNodeChange = useCallback((updated: ModeMapNode) => {
    const newNodes = nodes.map(n => n.id === updated.id
      ? { ...n, type: updated.type, data: updated.data as Record<string, unknown> } : n);
    setNodes(newNodes); scheduleSave(newNodes, edges);
  }, [nodes, edges, setNodes, scheduleSave]);

  const handleDeleteNode = useCallback(() => {
    if (!selectedNodeId) return;
    const newNodes = nodes.filter(n => n.id !== selectedNodeId);
    const newEdges = edges.filter(e => e.source !== selectedNodeId && e.target !== selectedNodeId);
    setNodes(newNodes); setEdges(newEdges); setSelectedNodeId(null);
    scheduleSave(newNodes, newEdges);
  }, [selectedNodeId, nodes, edges, setNodes, setEdges, scheduleSave]);

  const handleEdgeChange = useCallback((updated: ModeMapEdge) => {
    const et = updated.data?.edgeType;
    const bidir = updated.data?.bidirectional;
    const color = edgeColor(et);
    const newEdges = edges.map(e => e.id !== updated.id ? e : {
      ...e, label: updated.label, data: updated.data as Record<string, unknown>,
      animated: et === 'activates', style: { stroke: color, strokeWidth: 2 },
      markerEnd: makeMarker(color),
      markerStart: bidir ? makeMarker(color) : undefined,
    });
    setEdges(newEdges); scheduleSave(nodes, newEdges);
  }, [nodes, edges, setEdges, scheduleSave]);

  const handleDeleteEdge = useCallback(() => {
    if (!selectedEdgeId) return;
    const newEdges = edges.filter(e => e.id !== selectedEdgeId);
    setEdges(newEdges); setSelectedEdgeId(null); scheduleSave(nodes, newEdges);
  }, [selectedEdgeId, nodes, edges, setEdges, scheduleSave]);

  // Keyboard shortcuts — after scheduleSave is declared
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'Escape') { setSelectedNodeId(null); setSelectedEdgeId(null); return; }
      if (e.key === 'Backspace' || e.key === 'Delete') {
        if (selectedNodeId) {
          const newNodes = nodes.filter(n => n.id !== selectedNodeId);
          const newEdges = edges.filter(e2 => e2.source !== selectedNodeId && e2.target !== selectedNodeId);
          setNodes(newNodes); setEdges(newEdges); setSelectedNodeId(null);
          scheduleSave(newNodes, newEdges);
        } else if (selectedEdgeId) {
          const newEdges = edges.filter(e2 => e2.id !== selectedEdgeId);
          setEdges(newEdges); setSelectedEdgeId(null);
          scheduleSave(nodes, newEdges);
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedNodeId, selectedEdgeId, nodes, edges, setNodes, setEdges, scheduleSave]);

  return (
    <ReactFlowProvider>
      <div style={{ display: 'flex', height: '100%', background: 'var(--bg)' }}>
        <ModeMapPalette onAdd={handleAddNode} />
        <ModeMapCanvas nodes={nodes} edges={edges} setNodes={setNodes} setEdges={setEdges}
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
          setSelectedNodeId={setSelectedNodeId} setSelectedEdgeId={setSelectedEdgeId}
          saveStatus={saveStatus} scheduleSave={scheduleSave} />
        {selectedNode && (
          <ModeMapNodeEditor
            node={{ id: selectedNode.id, type: selectedNode.type as ModeMapNode['type'], position: selectedNode.position, data: selectedNode.data as unknown as ModeMapNode['data'] }}
            onChange={handleNodeChange} onDelete={handleDeleteNode} />
        )}
        {selectedEdge && !selectedNode && (
          <ModeMapEdgeEditor
            edge={{ id: selectedEdge.id, source: selectedEdge.source, target: selectedEdge.target, label: selectedEdge.label as string | undefined, data: selectedEdge.data as unknown as ModeMapEdge['data'] }}
            onChange={handleEdgeChange} onDelete={handleDeleteEdge} />
        )}
      </div>
    </ReactFlowProvider>
  );
}
