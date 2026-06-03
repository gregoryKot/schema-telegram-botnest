import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow, ReactFlowProvider, Background, BackgroundVariant, Controls, MiniMap, Panel,
  addEdge, useNodesState, useEdgesState, useReactFlow,
  MarkerType, ConnectionMode,
  type Connection, type Node, type Edge, type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type { ModeMapNode, ModeMapEdge } from '../api';
import { api } from '../api';
import { NODE_TYPES, NODE_DEFAULT_SIZES } from './ModeMapNodes';
import { ModeMapPalette, DRAG_TYPE } from './ModeMapPalette';
import { ModeMapNodeEditor, ModeMapEdgeEditor } from './ModeMapNodeEditor';

type FlowNode = Node<Record<string, unknown>>;
type FlowEdge = Edge<Record<string, unknown>>;

function edgeColor(d?: ModeMapEdge['data']) {
  if (d?.color) return d.color;            // explicit user color wins
  const t = d?.edgeType;
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
    const d = e.data as ModeMapEdge['data'];
    const color = edgeColor(d);
    return {
      id: e.id, source: e.source, target: e.target,
      sourceHandle: e.sourceHandle ?? undefined,
      targetHandle: e.targetHandle ?? undefined,
      label: e.label || undefined,
      data: e.data as Record<string, unknown>,
      type: 'smoothstep', animated: d?.edgeType === 'activates',
      style: { stroke: color, strokeWidth: 2 },
      markerEnd: makeMarker(color),
      markerStart: d?.bidirectional ? makeMarker(color) : undefined,
      ...(e.label ? { labelStyle: { fontSize: 11, fill: 'var(--text-sub)' }, labelBgStyle: { fill: 'var(--bg-elev)', fillOpacity: 0.85 } } : {}),
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
    sourceHandle: e.sourceHandle ?? null,
    targetHandle: e.targetHandle ?? null,
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
  pushHistory: () => void;
  nodesRef: React.MutableRefObject<FlowNode[]>;
  edgesRef: React.MutableRefObject<FlowEdge[]>;
  onUndo: () => void; onRedo: () => void;
  canUndo: boolean; canRedo: boolean;
}

function ModeMapCanvas({ nodes, edges, setNodes, setEdges, onNodesChange, onEdgesChange,
  setSelectedNodeId, setSelectedEdgeId, saveStatus, scheduleSave,
  pushHistory, nodesRef, edgesRef, onUndo, onRedo, canUndo, canRedo }: CanvasProps) {
  const { screenToFlowPosition, zoomIn, zoomOut, fitView } = useReactFlow();

  const isValidConnection = useCallback((conn: Connection | FlowEdge) => {
    // Prevent self-connections
    return conn.source !== conn.target;
  }, []);

  const onConnect = useCallback((conn: Connection) => {
    if (conn.source === conn.target) return; // extra guard
    pushHistory();
    const color = edgeColor({ edgeType: 'activates' });
    const newEdges = addEdge({
      ...conn, type: 'smoothstep',
      data: { edgeType: 'activates' } as Record<string, unknown>,
      animated: true, style: { stroke: color, strokeWidth: 2 },
      markerEnd: makeMarker(color),
    }, edges);
    setEdges(newEdges); scheduleSave(nodes, newEdges);
  }, [edges, nodes, setEdges, scheduleSave, pushHistory]);

  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }, []);
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData(DRAG_TYPE);
    if (!raw) return;
    try {
      const partial: Omit<ModeMapNode, 'position'> = JSON.parse(raw);
      const freshId = `${partial.data.modeId ?? 'node'}_${Date.now()}`;
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const defaultSize = NODE_DEFAULT_SIZES[partial.type] ?? {};
      pushHistory();
      const newNodes = [...nodes, { id: freshId, type: partial.type, position, data: partial.data as Record<string, unknown>, ...defaultSize }];
      setNodes(newNodes); scheduleSave(newNodes, edges);
    } catch { /* ignore */ }
  }, [nodes, edges, setNodes, scheduleSave, screenToFlowPosition, pushHistory]);

  // Apply changes; snapshot history at drag/resize start, save at end.
  const draggingRef = useRef(false);
  const onNodesChangeWithSave = useCallback((changes: Parameters<typeof onNodesChange>[0]) => {
    const startMove = changes.some(c =>
      (c.type === 'position' && c.dragging === true) ||
      (c.type === 'dimensions' && c.resizing === true)
    );
    if (startMove && !draggingRef.current) { draggingRef.current = true; pushHistory(); }
    onNodesChange(changes);
    const endMove = changes.some(c =>
      (c.type === 'position' && c.dragging === false) ||
      (c.type === 'dimensions' && c.resizing === false)
    );
    if (endMove) {
      draggingRef.current = false;
      // nodesRef updates on next render — defer save to read fresh positions
      setTimeout(() => scheduleSave(nodesRef.current, edgesRef.current), 0);
    }
  }, [onNodesChange, scheduleSave, pushHistory, nodesRef, edgesRef]);

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
        isValidConnection={isValidConnection}
        connectionMode={ConnectionMode.Loose}
        onNodeClick={(_, node) => { setSelectedNodeId(node.id); setSelectedEdgeId(null); }}
        onEdgeClick={(_, edge) => { setSelectedEdgeId(edge.id); setSelectedNodeId(null); }}
        onPaneClick={() => { setSelectedNodeId(null); setSelectedEdgeId(null); }}
        fitView fitViewOptions={{ padding: 0.2 }} deleteKeyCode={null}
        nodesDraggable nodeDragThreshold={1}
      >
        <Background variant={BackgroundVariant.Dots} color="rgba(var(--fg-rgb),0.18)" gap={22} size={1.5} />
        <Controls showZoom={false} showFitView={false} showInteractive={false}
          style={{ background: 'var(--bg-elev)', border: '1px solid rgba(var(--fg-rgb),0.1)' }} />
        <MiniMap style={{ background: 'var(--bg-elev)' }} nodeColor={() => 'rgba(var(--fg-rgb),0.15)'} pannable zoomable />

        {/* Toolbar */}
        <Panel position="top-left">
          <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 9,
            background: 'var(--bg-elev)', border: '1px solid rgba(var(--fg-rgb),0.1)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <TbBtn label="Отменить (⌘Z)" disabled={!canUndo} onClick={onUndo}>↶</TbBtn>
            <TbBtn label="Вернуть (⌘⇧Z)" disabled={!canRedo} onClick={onRedo}>↷</TbBtn>
            <TbSep />
            <TbBtn label="Приблизить" onClick={() => zoomIn()}>＋</TbBtn>
            <TbBtn label="Отдалить" onClick={() => zoomOut()}>－</TbBtn>
            <TbBtn label="Показать всё" onClick={() => fitView({ padding: 0.2 })}>⤢</TbBtn>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}

function TbBtn({ children, label, onClick, disabled }: {
  children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled} title={label}
      style={{ width: 30, height: 30, borderRadius: 6, border: 'none', cursor: disabled ? 'default' : 'pointer',
        background: 'none', fontSize: 16, lineHeight: 1,
        color: disabled ? 'var(--text-ghost)' : 'var(--text-sub)',
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = 'rgba(var(--fg-rgb),0.07)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}>
      {children}
    </button>
  );
}
function TbSep() {
  return <div style={{ width: 1, background: 'rgba(var(--fg-rgb),0.1)', margin: '4px 2px' }} />;
}

// ─── Public component ─────────────────────────────────────────────────────────

interface Props {
  mapId: number;
  clientId: number;
  initialNodes: ModeMapNode[];
  initialEdges: ModeMapEdge[];
}

type Snapshot = { nodes: FlowNode[]; edges: FlowEdge[] };

export function ModeMapEditor({ mapId, clientId, initialNodes, initialEdges }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(toFlowNodes(initialNodes));
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>(toFlowEdges(initialEdges));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Always-fresh refs (for deferred saves after React Flow internal updates)
  const nodesRef = useRef(nodes); nodesRef.current = nodes;
  const edgesRef = useRef(edges); edgesRef.current = edges;

  // Undo/redo history
  const past = useRef<Snapshot[]>([]);
  const future = useRef<Snapshot[]>([]);
  const [histVer, setHistVer] = useState(0);
  const pushHistory = useCallback(() => {
    past.current.push({ nodes: nodesRef.current, edges: edgesRef.current });
    if (past.current.length > 60) past.current.shift();
    future.current = [];
    setHistVer(v => v + 1);
  }, []);

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

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push({ nodes: nodesRef.current, edges: edgesRef.current });
    setNodes(prev.nodes); setEdges(prev.edges);
    setSelectedNodeId(null); setSelectedEdgeId(null);
    setHistVer(v => v + 1);
    scheduleSave(prev.nodes, prev.edges);
  }, [setNodes, setEdges, scheduleSave]);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push({ nodes: nodesRef.current, edges: edgesRef.current });
    setNodes(next.nodes); setEdges(next.edges);
    setSelectedNodeId(null); setSelectedEdgeId(null);
    setHistVer(v => v + 1);
    scheduleSave(next.nodes, next.edges);
  }, [setNodes, setEdges, scheduleSave]);

  const handleAddNode = useCallback((partial: Omit<ModeMapNode, 'position'>) => {
    const pos = { x: 220 + Math.random() * 280, y: 100 + Math.random() * 200 };
    const defaultSize = NODE_DEFAULT_SIZES[partial.type] ?? {};
    pushHistory();
    const newNodes = [...nodes, { id: partial.id, type: partial.type, position: pos, data: partial.data as Record<string, unknown>, ...defaultSize }];
    setNodes(newNodes); scheduleSave(newNodes, edges);
  }, [nodes, edges, setNodes, scheduleSave, pushHistory]);

  const handleNodeChange = useCallback((updated: ModeMapNode) => {
    pushHistory();
    const newNodes = nodes.map(n => n.id === updated.id
      ? { ...n, type: updated.type, data: updated.data as Record<string, unknown> } : n);
    setNodes(newNodes); scheduleSave(newNodes, edges);
  }, [nodes, edges, setNodes, scheduleSave, pushHistory]);

  const handleDeleteNode = useCallback(() => {
    if (!selectedNodeId) return;
    pushHistory();
    const newNodes = nodes.filter(n => n.id !== selectedNodeId);
    const newEdges = edges.filter(e => e.source !== selectedNodeId && e.target !== selectedNodeId);
    setNodes(newNodes); setEdges(newEdges); setSelectedNodeId(null);
    scheduleSave(newNodes, newEdges);
  }, [selectedNodeId, nodes, edges, setNodes, setEdges, scheduleSave, pushHistory]);

  const handleEdgeChange = useCallback((updated: ModeMapEdge) => {
    pushHistory();
    const d = updated.data;
    const color = edgeColor(d);
    const newEdges = edges.map(e => e.id !== updated.id ? e : {
      ...e, label: updated.label || undefined, data: updated.data as Record<string, unknown>,
      animated: d?.edgeType === 'activates', style: { stroke: color, strokeWidth: 2 },
      markerEnd: makeMarker(color),
      markerStart: d?.bidirectional ? makeMarker(color) : undefined,
      ...(updated.label ? { labelStyle: { fontSize: 11, fill: 'var(--text-sub)' }, labelBgStyle: { fill: 'var(--bg-elev)', fillOpacity: 0.85 } } : { label: undefined }),
    });
    setEdges(newEdges); scheduleSave(nodes, newEdges);
  }, [nodes, edges, setEdges, scheduleSave, pushHistory]);

  const handleDeleteEdge = useCallback(() => {
    if (!selectedEdgeId) return;
    pushHistory();
    const newEdges = edges.filter(e => e.id !== selectedEdgeId);
    setEdges(newEdges); setSelectedEdgeId(null); scheduleSave(nodes, newEdges);
  }, [selectedEdgeId, nodes, edges, setEdges, scheduleSave, pushHistory]);

  const handleSwapEdge = useCallback(() => {
    if (!selectedEdgeId) return;
    pushHistory();
    const newEdges = edges.map(e => e.id !== selectedEdgeId ? e : {
      ...e, source: e.target, target: e.source,
      sourceHandle: e.targetHandle, targetHandle: e.sourceHandle,
    });
    setEdges(newEdges); scheduleSave(nodes, newEdges);
  }, [selectedEdgeId, nodes, edges, setEdges, scheduleSave, pushHistory]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      // Undo / Redo
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault(); redo(); return;
      }
      if (e.key === 'Escape') { setSelectedNodeId(null); setSelectedEdgeId(null); return; }
      if (e.key === 'Backspace' || e.key === 'Delete') {
        if (selectedNodeId) {
          pushHistory();
          const newNodes = nodes.filter(n => n.id !== selectedNodeId);
          const newEdges = edges.filter(e2 => e2.source !== selectedNodeId && e2.target !== selectedNodeId);
          setNodes(newNodes); setEdges(newEdges); setSelectedNodeId(null);
          scheduleSave(newNodes, newEdges);
        } else if (selectedEdgeId) {
          pushHistory();
          const newEdges = edges.filter(e2 => e2.id !== selectedEdgeId);
          setEdges(newEdges); setSelectedEdgeId(null);
          scheduleSave(nodes, newEdges);
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedNodeId, selectedEdgeId, nodes, edges, setNodes, setEdges, scheduleSave, pushHistory, undo, redo]);

  return (
    <ReactFlowProvider>
      <div style={{ display: 'flex', height: '100%', background: 'var(--bg)' }}>
        <ModeMapPalette onAdd={handleAddNode} clientId={clientId} />
        <ModeMapCanvas nodes={nodes} edges={edges} setNodes={setNodes} setEdges={setEdges}
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
          setSelectedNodeId={setSelectedNodeId} setSelectedEdgeId={setSelectedEdgeId}
          saveStatus={saveStatus} scheduleSave={scheduleSave}
          pushHistory={pushHistory} nodesRef={nodesRef} edgesRef={edgesRef}
          onUndo={undo} onRedo={redo}
          canUndo={past.current.length > 0} canRedo={future.current.length > 0} />
        {/* histVer triggers re-render so canUndo/canRedo refresh */}
        <span style={{ display: 'none' }}>{histVer}</span>
        {selectedNode && (
          <ModeMapNodeEditor
            node={{ id: selectedNode.id, type: selectedNode.type as ModeMapNode['type'], position: selectedNode.position, data: selectedNode.data as unknown as ModeMapNode['data'] }}
            onChange={handleNodeChange} onDelete={handleDeleteNode} />
        )}
        {selectedEdge && !selectedNode && (
          <ModeMapEdgeEditor
            edge={{ id: selectedEdge.id, source: selectedEdge.source, target: selectedEdge.target, label: selectedEdge.label as string | undefined, data: selectedEdge.data as unknown as ModeMapEdge['data'] }}
            onChange={handleEdgeChange} onDelete={handleDeleteEdge} onSwap={handleSwapEdge} />
        )}
      </div>
    </ReactFlowProvider>
  );
}
