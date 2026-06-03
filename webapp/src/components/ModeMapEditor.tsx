import { useCallback, useEffect, useRef, useState } from 'react';
import { ReactFlowProvider, useNodesState, useEdgesState } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type { ModeMapNode, ModeMapEdge } from '../api';
import { api } from '../api';
import { NODE_DEFAULT_SIZES } from './ModeMapNodes';
import { ModeMapPalette } from './ModeMapPalette';
import { ModeMapNodeEditor, ModeMapEdgeEditor } from './ModeMapNodeEditor';
import { ModeMapCanvas } from './ModeMapCanvas';
import {
  type FlowNode, type FlowEdge,
  edgeColor, edgeStyle, makeMarker,
  toFlowEdges, toFlowNodes, fromFlowNodes, fromFlowEdges,
} from './modeMapFlow';
import { useModeMapHistory } from './useModeMapHistory';


// ─── Public component ─────────────────────────────────────────────────────────

interface Props {
  mapId: number;
  clientId: number;
  initialNodes: ModeMapNode[];
  initialEdges: ModeMapEdge[];
}

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

  const clearSelection = useCallback(() => { setSelectedNodeId(null); setSelectedEdgeId(null); }, []);
  const { pushHistory, undo, redo, canUndo, canRedo } = useModeMapHistory({
    nodesRef, edgesRef, setNodes, setEdges, scheduleSave, clearSelection,
  });

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
    const newEdges = edges.map(e => {
      if (e.id !== updated.id) return e;
      // Rebuild edge from scratch so removed markers/labels don't linger
      const { markerStart: _ms, label: _l, labelStyle: _ls, labelBgStyle: _lbg, animated: _an, ...base } = e;
      const rebuilt: FlowEdge = {
        ...base,
        data: updated.data as Record<string, unknown>,
        style: edgeStyle(color, d?.lineStyle),
        markerEnd: makeMarker(color),
      };
      if (d?.bidirectional) rebuilt.markerStart = makeMarker(color);
      if (updated.label) {
        rebuilt.label = updated.label;
        rebuilt.labelStyle = { fontSize: 11, fill: 'var(--text-sub)' };
        rebuilt.labelBgStyle = { fill: 'var(--bg-elev)', fillOpacity: 0.85 };
      }
      return rebuilt;
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
      // Duplicate selected node (Cmd/Ctrl+D)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        const sel = nodes.filter(n => n.selected).map(n => n.id);
        const ids = sel.length ? sel : (selectedNodeId ? [selectedNodeId] : []);
        if (ids.length) {
          pushHistory();
          const copies = ids.map(id => {
            const src = nodes.find(n => n.id === id); if (!src) return null;
            return { ...src, id: `${src.type}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              position: { x: src.position.x + 40, y: src.position.y + 40 }, selected: false, data: { ...src.data } };
          }).filter(Boolean) as typeof nodes;
          const newNodes = [...nodes, ...copies];
          setNodes(newNodes); scheduleSave(newNodes, edges);
        }
        return;
      }
      if (e.key === 'Escape') { setSelectedNodeId(null); setSelectedEdgeId(null); return; }
      if (e.key === 'Backspace' || e.key === 'Delete') {
        // Multi-select (Shift+box) → delete all selected; else single selection
        const selNodes = nodes.filter(n => n.selected).map(n => n.id);
        const selEdges = edges.filter(e2 => e2.selected).map(e2 => e2.id);
        if (selNodes.length || selEdges.length) {
          pushHistory();
          const delN = new Set(selNodes);
          const newNodes = nodes.filter(n => !delN.has(n.id));
          const newEdges = edges.filter(e2 => !selEdges.includes(e2.id) && !delN.has(e2.source) && !delN.has(e2.target));
          setNodes(newNodes); setEdges(newEdges); setSelectedNodeId(null); setSelectedEdgeId(null);
          scheduleSave(newNodes, newEdges);
        } else if (selectedNodeId) {
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
        <ModeMapCanvas clientId={clientId} mapId={mapId} nodes={nodes} edges={edges} setNodes={setNodes} setEdges={setEdges}
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
          setSelectedNodeId={setSelectedNodeId} setSelectedEdgeId={setSelectedEdgeId}
          saveStatus={saveStatus} scheduleSave={scheduleSave}
          pushHistory={pushHistory} nodesRef={nodesRef} edgesRef={edgesRef}
          onUndo={undo} onRedo={redo} canUndo={canUndo} canRedo={canRedo} />
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
