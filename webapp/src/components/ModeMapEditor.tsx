import { useCallback, useEffect, useRef, useState } from 'react';
import { ReactFlowProvider, useNodesState, useEdgesState } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type { ModeMapNode, ModeMapEdge, ModeMapKind, UserId } from '../api';
import { ModeMapPalette } from './ModeMapPalette';
import { ModeMapNodeEditor, ModeMapEdgeEditor } from './ModeMapNodeEditor';
import { ModeMapCanvas } from './ModeMapCanvas';
import {
  type FlowNode, type FlowEdge,
  edgeColor, edgeStyle, makeMarker,
  toFlowEdges, toFlowNodes,
} from './modeMapFlow';
import { useModeMapHistory } from './useModeMapHistory';
import { useModeMapAutosave } from './useModeMapAutosave';
import { PaletteEar } from './modeMap/PaletteEar';
import { paletteOpenInitial } from './modeMap/paletteOpen';
import { useSettleFresh } from './modeMap/useSettleFresh';
import { useCanvasSpace } from './modeMap/useCanvasSpace';
import { ModeMapConceptProvider } from './modeMap/ModeMapConceptProvider';
import { useMapKeys } from './modeMap/useMapKeys';
import { WHEEL_SIZE } from './modeMap/needWheel';
import { useWheelConvert } from './modeMap/useWheelConvert';

// ─── Public component ─────────────────────────────────────────────────────────

interface Props {
  mapId: number;
  clientId: UserId;
  kind: ModeMapKind;
  initialNodes: ModeMapNode[];
  initialEdges: ModeMapEdge[];
}

// Провайдер снаружи: добавлению фигур из палитры нужен вьюпорт холста (useCanvasSpace).
export function ModeMapEditor(props: Props) {
  return <ReactFlowProvider><EditorBody {...props} /></ReactFlowProvider>;
}

function EditorBody({ mapId, clientId, kind, initialNodes, initialEdges }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(toFlowNodes(initialNodes));
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>(toFlowEdges(initialEdges));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(() => paletteOpenInitial(localStorage.getItem('modemap_palette'), window.innerWidth));
  const setPalette = (open: boolean) => { setPaletteOpen(open); localStorage.setItem('modemap_palette', open ? '1' : '0'); }; // пишет только выбор терапевта

  // Always-fresh refs (for deferred saves after React Flow internal updates).
  // Пишем в эффекте, а не в рендере (react-hooks/refs): читаются только в
  // отложенных сохранениях/undo-redo — уже после коммита.
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  useEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
  });

  const selectedNode = nodes.find(n => n.id === selectedNodeId) ?? null;
  const selectedEdge = edges.find(e => e.id === selectedEdgeId) ?? null;

  const { saveStatus, savedAt, saveError, retry: retrySave, scheduleSave } = useModeMapAutosave(mapId, nodesRef, edgesRef);
  useSettleFresh({ nodes, edgesRef, setNodes, scheduleSave }); // свежая схема случая: колонки по реальной высоте

  const clearSelection = useCallback(() => { setSelectedNodeId(null); setSelectedEdgeId(null); }, []);
  const { pushHistory, undo, redo, canUndo, canRedo } = useModeMapHistory({
    nodesRef, edgesRef, setNodes, setEdges, scheduleSave, clearSelection,
  });

  // Фигуры из палитры (одна или «вынести все режимы клиента») ложатся на свободные
  // места видимой области, а не случайно друг на друга (useCanvasSpace).
  const { place } = useCanvasSpace();
  const handleAddMany = useCallback((partials: Omit<ModeMapNode, 'position'>[]) => {
    if (!partials.length) return;
    pushHistory();
    const spots = place(nodes, partials.length, partials.some(p => p.type === 'needs') ? WHEEL_SIZE : undefined); // колесо больше режима
    const newNodes = [...nodes, ...toFlowNodes(partials.map((p, i) => ({ ...p, position: spots[i] })))]; // круг — под фигурами (zIndex −1)
    setNodes(newNodes); scheduleSave(newNodes, edges);
  }, [nodes, edges, setNodes, scheduleSave, pushHistory, place]);
  const handleAddNode = useCallback((partial: Omit<ModeMapNode, 'position'>) => handleAddMany([partial]), [handleAddMany]);
  const toWheel = useWheelConvert({ nodes, edges, setNodes, setEdges, scheduleSave, pushHistory });

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
        style: edgeStyle(color, d?.lineStyle, d?.width),
        markerEnd: makeMarker(color, d?.width),
      };
      if (d?.bidirectional) rebuilt.markerStart = makeMarker(color, d?.width);
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

  useMapKeys({ nodes, edges, selectedNodeId, selectedEdgeId, setNodes, setEdges, setSelectedNodeId, setSelectedEdgeId,
    scheduleSave, pushHistory, undo, redo });

  // Палитра и боковой редактор — flex-колонки по бокам холста. Холст бывает только
  // на компьютере и планшете: на телефоне вкладка показывает ModeMapTab без него.
  const nodeEditor = selectedNode && (
    <ModeMapNodeEditor
      node={{ id: selectedNode.id, type: selectedNode.type as ModeMapNode['type'], position: selectedNode.position, data: selectedNode.data as unknown as ModeMapNode['data'] }}
      onChange={handleNodeChange} onDelete={handleDeleteNode} clientId={clientId} onToWheel={() => toWheel(selectedNode.id)}
      coupleMode={kind === 'couple'}
      onClose={() => setSelectedNodeId(null)} />
  );
  const edgeEditor = selectedEdge && !selectedNode && (
    <ModeMapEdgeEditor
      key={selectedEdge.id}
      edge={{ id: selectedEdge.id, source: selectedEdge.source, target: selectedEdge.target, label: selectedEdge.label as string | undefined, data: selectedEdge.data as unknown as ModeMapEdge['data'] }}
      onChange={handleEdgeChange} onDelete={handleDeleteEdge} onSwap={handleSwapEdge}
      onClose={() => setSelectedEdgeId(null)} />
  );

  const paletteCol = (
    <div className="mm2-pal-col">
      <ModeMapPalette onAdd={handleAddNode} onAddMany={handleAddMany} />
      <PaletteEar open onToggle={() => setPalette(false)} />
    </div>
  );

  return (
    <ModeMapConceptProvider clientId={clientId} kind={kind} nodes={nodes} edges={edges}><div className="mm2-editor">
      {paletteOpen ? paletteCol : <PaletteEar open={false} onToggle={() => setPalette(true)} />}

      <ModeMapCanvas clientId={clientId} mapId={mapId} kind={kind} nodes={nodes} edges={edges} setNodes={setNodes} setEdges={setEdges}
        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
        setSelectedNodeId={setSelectedNodeId} setSelectedEdgeId={setSelectedEdgeId}
        saveStatus={saveStatus} savedAt={savedAt} saveError={saveError} onRetrySave={retrySave} scheduleSave={scheduleSave}
        pushHistory={pushHistory} nodesRef={nodesRef} edgesRef={edgesRef}
        onUndo={undo} onRedo={redo} canUndo={canUndo} canRedo={canRedo} />

      {nodeEditor || edgeEditor}
    </div></ModeMapConceptProvider>
  );
}
