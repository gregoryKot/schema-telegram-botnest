import { useCallback, useRef, useState } from 'react';
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState, useReactFlow,
  type Connection, type Node, type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type { ModeMapNode, ModeMapEdge, ClientConceptualization } from '../api';
import { api } from '../api';
import { NODE_TYPES } from './ModeMapNodes';
import { ModeMapPalette, DRAG_TYPE } from './ModeMapPalette';
import { ModeMapNodeEditor, ModeMapEdgeEditor } from './ModeMapNodeEditor';

type FlowNode = Node<ModeMapNode['data'], ModeMapNode['type']>;
type FlowEdge = Edge<ModeMapEdge['data']>;

function toFlowNodes(nodes: ModeMapNode[]): FlowNode[] {
  return nodes.map(n => ({ id: n.id, type: n.type, position: n.position, data: n.data }));
}

function toFlowEdges(edges: ModeMapEdge[]): FlowEdge[] {
  return edges.map(e => ({
    id: e.id, source: e.source, target: e.target,
    label: e.label, data: e.data,
    type: 'smoothstep',
    animated: e.data?.edgeType === 'activates',
    style: { stroke: edgeColor(e.data?.edgeType), strokeWidth: 2 },
    labelStyle: { fontSize: 11, fill: 'var(--text-sub)' },
    labelBgStyle: { fill: 'var(--bg-elev)', fillOpacity: 0.85 },
  }));
}

function edgeColor(t?: string) {
  if (t === 'suppresses') return 'var(--accent-red)';
  if (t === 'protects')   return 'var(--accent-green)';
  if (t === 'leads_to')   return 'var(--accent-orange)';
  return 'rgba(var(--fg-rgb),0.4)';
}

function fromFlowNodes(nodes: FlowNode[]): ModeMapNode[] {
  return nodes.map(n => ({ id: n.id, type: n.type as ModeMapNode['type'], position: n.position, data: n.data }));
}

function fromFlowEdges(edges: FlowEdge[]): ModeMapEdge[] {
  return edges.map(e => ({ id: e.id, source: e.source, target: e.target, label: e.label as string | undefined, data: e.data }));
}

// ─── Inner canvas — uses useReactFlow (must be inside ReactFlowProvider) ──────

interface CanvasProps {
  clientId: number;
  nodes: FlowNode[];
  edges: FlowEdge[];
  setNodes: ReturnType<typeof useNodesState<FlowNode>>[1];
  setEdges: ReturnType<typeof useEdgesState<FlowEdge>>[1];
  onNodesChange: ReturnType<typeof useNodesState<FlowNode>>[2];
  onEdgesChange: ReturnType<typeof useEdgesState<FlowEdge>>[2];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  setSelectedEdgeId: (id: string | null) => void;
  saveStatus: 'idle' | 'saving' | 'saved';
  scheduleSave: (ns: FlowNode[], es: FlowEdge[]) => void;
}

function ModeMapCanvas({
  nodes, edges, setNodes, setEdges, onNodesChange, onEdgesChange,
  selectedNodeId, selectedEdgeId, setSelectedNodeId, setSelectedEdgeId,
  saveStatus, scheduleSave,
}: CanvasProps) {
  const { screenToFlowPosition } = useReactFlow();

  const onConnect = useCallback((conn: Connection) => {
    const newEdges = addEdge({
      ...conn, type: 'smoothstep', label: 'активирует',
      data: { edgeType: 'activates' }, animated: true,
      style: { stroke: edgeColor('activates'), strokeWidth: 2 },
      labelStyle: { fontSize: 11, fill: 'var(--text-sub)' },
      labelBgStyle: { fill: 'var(--bg-elev)', fillOpacity: 0.85 },
    }, edges);
    setEdges(newEdges);
    scheduleSave(nodes, newEdges);
  }, [edges, nodes, setEdges, scheduleSave]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData(DRAG_TYPE);
    if (!raw) return;
    try {
      const partial: Omit<ModeMapNode, 'position'> = JSON.parse(raw);
      // Give dropped node a fresh id to allow multiple drops of the same mode
      const freshId = `${partial.data.modeId ?? 'node'}_${Date.now()}`;
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const newNode: FlowNode = { id: freshId, type: partial.type, position, data: partial.data };
      const newNodes = [...nodes, newNode];
      setNodes(newNodes);
      scheduleSave(newNodes, edges);
    } catch { /* ignore malformed data */ }
  }, [nodes, edges, setNodes, scheduleSave, screenToFlowPosition]);

  const onNodesChangeWithSave = useCallback((changes: Parameters<typeof onNodesChange>[0]) => {
    onNodesChange(changes);
    if (changes.some(c => c.type === 'position' && !c.dragging)) scheduleSave(nodes, edges);
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
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        onNodesChange={onNodesChangeWithSave}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeClick={(_, node) => { setSelectedNodeId(node.id); setSelectedEdgeId(null); }}
        onEdgeClick={(_, edge) => { setSelectedEdgeId(edge.id); setSelectedNodeId(null); }}
        onPaneClick={() => { setSelectedNodeId(null); setSelectedEdgeId(null); }}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        deleteKeyCode={null}
      >
        <Background color="rgba(var(--fg-rgb),0.06)" gap={20} />
        <Controls style={{ background: 'var(--bg-elev)', border: '1px solid rgba(var(--fg-rgb),0.1)' }} />
        <MiniMap style={{ background: 'var(--bg-elev)' }} nodeColor={() => 'rgba(var(--fg-rgb),0.15)'} />
      </ReactFlow>
    </div>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────

interface Props {
  clientId: number;
  initial: ClientConceptualization | null;
}

export function ModeMapEditor({ clientId, initial }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(toFlowNodes(initial?.modeMapNodes ?? []));
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>(toFlowEdges(initial?.modeMapEdges ?? []));
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
        await api.saveConceptualization(clientId, {
          modeMapNodes: fromFlowNodes(ns) as unknown[],
          modeMapEdges: fromFlowEdges(es) as unknown[],
        });
        setSaveStatus('saved');
      } catch { setSaveStatus('idle'); }
    }, 1200);
  }, [clientId]);

  const handleAddNode = useCallback((partial: Omit<ModeMapNode, 'position'>) => {
    const pos = { x: 220 + Math.random() * 280, y: 100 + Math.random() * 200 };
    const newNode: FlowNode = { id: partial.id, type: partial.type, position: pos, data: partial.data };
    const newNodes = [...nodes, newNode];
    setNodes(newNodes);
    scheduleSave(newNodes, edges);
  }, [nodes, edges, setNodes, scheduleSave]);

  const handleNodeChange = useCallback((updated: ModeMapNode) => {
    const newNodes = nodes.map(n => n.id === updated.id ? { ...n, data: updated.data } : n);
    setNodes(newNodes);
    scheduleSave(newNodes, edges);
  }, [nodes, edges, setNodes, scheduleSave]);

  const handleDeleteNode = useCallback(() => {
    if (!selectedNodeId) return;
    const newNodes = nodes.filter(n => n.id !== selectedNodeId);
    const newEdges = edges.filter(e => e.source !== selectedNodeId && e.target !== selectedNodeId);
    setNodes(newNodes); setEdges(newEdges); setSelectedNodeId(null);
    scheduleSave(newNodes, newEdges);
  }, [selectedNodeId, nodes, edges, setNodes, setEdges, scheduleSave]);

  const handleEdgeChange = useCallback((updated: ModeMapEdge) => {
    const newEdges = edges.map(e => e.id !== updated.id ? e : {
      ...e, label: updated.label, data: updated.data,
      animated: updated.data?.edgeType === 'activates',
      style: { stroke: edgeColor(updated.data?.edgeType), strokeWidth: 2 },
    });
    setEdges(newEdges);
    scheduleSave(nodes, newEdges);
  }, [nodes, edges, setEdges, scheduleSave]);

  const handleDeleteEdge = useCallback(() => {
    if (!selectedEdgeId) return;
    const newEdges = edges.filter(e => e.id !== selectedEdgeId);
    setEdges(newEdges); setSelectedEdgeId(null);
    scheduleSave(nodes, newEdges);
  }, [selectedEdgeId, nodes, edges, setEdges, scheduleSave]);

  return (
    <ReactFlowProvider>
      <div style={{ display: 'flex', height: '100%', background: 'var(--bg)' }}>
        <ModeMapPalette onAdd={handleAddNode} />
        <ModeMapCanvas
          clientId={clientId}
          nodes={nodes} edges={edges}
          setNodes={setNodes} setEdges={setEdges}
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
          selectedNodeId={selectedNodeId} selectedEdgeId={selectedEdgeId}
          setSelectedNodeId={setSelectedNodeId} setSelectedEdgeId={setSelectedEdgeId}
          saveStatus={saveStatus} scheduleSave={scheduleSave}
        />
        {selectedNode && (
          <ModeMapNodeEditor
            node={{ id: selectedNode.id, type: selectedNode.type as ModeMapNode['type'], position: selectedNode.position, data: selectedNode.data }}
            onChange={handleNodeChange}
            onDelete={handleDeleteNode}
          />
        )}
        {selectedEdge && !selectedNode && (
          <ModeMapEdgeEditor
            edge={{ id: selectedEdge.id, source: selectedEdge.source, target: selectedEdge.target, label: selectedEdge.label as string | undefined, data: selectedEdge.data }}
            onChange={handleEdgeChange}
            onDelete={handleDeleteEdge}
          />
        )}
      </div>
    </ReactFlowProvider>
  );
}
