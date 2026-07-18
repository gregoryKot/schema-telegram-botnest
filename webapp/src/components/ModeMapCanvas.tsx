import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow, Background, BackgroundVariant, Panel,
  addEdge, useReactFlow, ConnectionMode,
  type Connection, type NodeTypes, type Viewport,
  type useNodesState, type useEdgesState,
} from '@xyflow/react';
import type { ModeMapNode, ModeMapEdge, ModeMapKind } from '../api';
import { api } from '../api';
import { NODE_TYPES } from './modeMapRegistry';
import { NODE_DEFAULT_SIZES } from './modeMapData';
import { EDGE_TYPES } from './modeMapRegistry';
import { DRAG_TYPE, GROUP_TO_TYPE } from './modeMapData';
import { MODE_GROUPS, getModeById, getSchemaById } from '../schemaTherapyData';
import { ModeMapContextMenu, type MenuItem } from './ModeMapContextMenu';
import { ModeMapLegend } from './ModeMapLegend';
import { ModeMapGuide } from './ModeMapGuide';
import { ModeMapZones } from './ModeMapZones';
import { ModeMapCoupleLanes } from './ModeMapCoupleLanes';
import { NodeActionsContext, type NodeActions } from './modeMapActions';
import { autoLayout, layoutByZones, layoutCouple, TEMPLATES, templateToGraph } from './modeMapLayout';
import {
  type FlowNode, type FlowEdge,
  edgeColor, makeMarker, edgeStyle, toFlowNodes, toFlowEdges,
} from './modeMapFlow';
import { useModeMapExport } from './useModeMapExport';
import { MMIcon } from './modeMapIcons';

export interface CanvasProps {
  clientId: number; mapId: number; kind: ModeMapKind;
  nodes: FlowNode[]; edges: FlowEdge[];
  setNodes: ReturnType<typeof useNodesState<FlowNode>>[1];
  setEdges: ReturnType<typeof useEdgesState<FlowEdge>>[1];
  onNodesChange: ReturnType<typeof useNodesState<FlowNode>>[2];
  onEdgesChange: ReturnType<typeof useEdgesState<FlowEdge>>[2];
  setSelectedNodeId: (id: string | null) => void;
  setSelectedEdgeId: (id: string | null) => void;
  selectedNodeId: string | null;
  saveStatus: 'idle' | 'saving' | 'saved';
  scheduleSave: (ns: FlowNode[], es: FlowEdge[]) => void;
  pushHistory: () => void;
  nodesRef: React.MutableRefObject<FlowNode[]>;
  edgesRef: React.MutableRefObject<FlowEdge[]>;
  onUndo: () => void; onRedo: () => void;
  canUndo: boolean; canRedo: boolean;
}

export function ModeMapCanvas({ clientId, mapId, kind, nodes, edges, setNodes, setEdges, onNodesChange, onEdgesChange,
  setSelectedNodeId, setSelectedEdgeId, selectedNodeId, saveStatus, scheduleSave,
  pushHistory, nodesRef, edgesRef, onUndo, onRedo, canUndo, canRedo }: CanvasProps) {
  const { screenToFlowPosition, zoomIn, zoomOut, fitView, setViewport } = useReactFlow();

  const [snap, setSnap] = useState(false);
  const [showLegend, setShowLegend] = useState(() => localStorage.getItem('modemap_legend') === '1');
  const [showGuide, setShowGuide] = useState(() => localStorage.getItem('modemap_guide') !== '0');
  const [showZones, setShowZones] = useState(() => localStorage.getItem('modemap_zones') === '1');
  const [tplOpen, setTplOpen] = useState(false);
  const [dlOpen, setDlOpen] = useState(false);
  const [keysOpen, setKeysOpen] = useState(false);
  const [schemasOpen, setSchemasOpen] = useState(false);
  const [clientSchemaIds, setClientSchemaIds] = useState<string[] | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);
  const tplWrapRef = useRef<HTMLDivElement>(null);
  const dlWrapRef = useRef<HTMLDivElement>(null);
  const keysWrapRef = useRef<HTMLDivElement>(null);
  const schemasWrapRef = useRef<HTMLDivElement>(null);

  // Lazy-load the client's identified schemas the first time the panel opens
  const openSchemas = useCallback(() => {
    setSchemasOpen(o => !o); setTplOpen(false); setDlOpen(false);
    if (clientSchemaIds === null) {
      api.getConceptualization(clientId)
        .then(c => setClientSchemaIds(Array.isArray(c?.schemaIds) ? c!.schemaIds : []))
        .catch(() => setClientSchemaIds([]));
    }
  }, [clientId, clientSchemaIds]);
  // Desktop (fine pointer) — keyboard hints only make sense there
  const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 900px) and (pointer: fine)').matches;

  const toggleLegend = useCallback(() => {
    setShowLegend(s => { localStorage.setItem('modemap_legend', s ? '0' : '1'); return !s; });
  }, []);
  const toggleGuide = useCallback(() => {
    setShowGuide(s => { localStorage.setItem('modemap_guide', s ? '0' : '1'); return !s; });
  }, []);
  const toggleZones = useCallback(() => {
    setShowZones(s => { localStorage.setItem('modemap_zones', s ? '0' : '1'); return !s; });
  }, []);

  // ── Viewport persistence (per map, localStorage) ────────────────────────────
  const vpKey = `modemap_vp_${mapId}`;
  const restoredVp = useRef(false);
  const onMoveEnd = useCallback((_: unknown, vp: Viewport) => {
    try { localStorage.setItem(vpKey, JSON.stringify(vp)); } catch { /* ignore */ }
  }, [vpKey]);
  useEffect(() => {
    if (restoredVp.current) return;
    restoredVp.current = true;
    try {
      const saved = localStorage.getItem(vpKey);
      if (saved) { const vp = JSON.parse(saved); setTimeout(() => setViewport(vp), 0); }
    } catch { /* ignore */ }
  }, [vpKey, setViewport]);

  const isValidConnection = useCallback((conn: Connection | FlowEdge) => {
    // Prevent self-connections
    return conn.source !== conn.target;
  }, []);

  const onConnect = useCallback((conn: Connection) => {
    if (conn.source === conn.target) return; // extra guard
    pushHistory();
    const color = edgeColor({ edgeType: 'activates' });
    const newEdges = addEdge({
      ...conn, type: 'floating',
      data: { edgeType: 'activates' } as Record<string, unknown>,
      style: edgeStyle(color),
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

  // Add a node from the guidance panel — drop it near the viewport centre
  const addNodeFromGuide = useCallback((partial: Omit<ModeMapNode, 'position'>) => {
    const el = document.querySelector('.react-flow') as HTMLElement | null;
    const r = el?.getBoundingClientRect();
    const pos = r ? screenToFlowPosition({ x: r.left + r.width / 2 + (Math.random() * 80 - 40), y: r.top + r.height / 2 + (Math.random() * 80 - 40) })
      : { x: 200 + Math.random() * 200, y: 150 };
    const defaultSize = NODE_DEFAULT_SIZES[partial.type] ?? {};
    pushHistory();
    const newNodes = [...nodesRef.current, { id: partial.id, type: partial.type, position: pos, data: partial.data as Record<string, unknown>, ...defaultSize }];
    setNodes(newNodes); scheduleSave(newNodes, edgesRef.current);
  }, [screenToFlowPosition, setNodes, scheduleSave, pushHistory, nodesRef, edgesRef]);

  // Open the unmet-need field on the Vulnerable Child node (from the guide's step 6)
  const onOpenNeed = useCallback(() => {
    const child = nodesRef.current.find(n => n.type === 'child') ?? nodesRef.current.find(n => n.type === 'custom');
    if (!child) return;
    setSelectedNodeId(child.id); setSelectedEdgeId(null);
    setTimeout(() => window.dispatchEvent(new CustomEvent('modemap-focus-need')), 40);
  }, [nodesRef, setSelectedNodeId, setSelectedEdgeId]);

  // Export (PNG / PDF) via shared hook
  const { exporting, onExportPng, onExportPdf } = useModeMapExport(nodes);

  // Apply changes; snapshot history at drag/resize start, save at end.
  const draggingRef = useRef(false);
  const onNodesChangeWithSave = useCallback((changes: Parameters<typeof onNodesChange>[0]) => {
    const startMove = changes.some(c =>
      (c.type === 'position' && c.dragging === true) ||
      (c.type === 'dimensions' && c.resizing === true)
    );
    if (startMove && !draggingRef.current) { draggingRef.current = true; pushHistory(); }
    onNodesChange(changes);
    // Mark nodes that were manually resized so rect nodes switch off auto-fit
    const resizedIds = changes
      .filter(c => c.type === 'dimensions' && c.resizing === true)
      .map(c => (c as { id: string }).id);
    if (resizedIds.length) {
      setNodes(prev => prev.map(n => resizedIds.includes(n.id) && !(n.data as { _resized?: boolean })._resized
        ? { ...n, data: { ...n.data, _resized: true } } : n));
    }
    const endMove = changes.some(c =>
      (c.type === 'position' && c.dragging === false) ||
      (c.type === 'dimensions' && c.resizing === false)
    );
    if (endMove) {
      draggingRef.current = false;
      // nodesRef updates on next render — defer save to read fresh positions
      setTimeout(() => scheduleSave(nodesRef.current, edgesRef.current), 0);
    }
  }, [onNodesChange, setNodes, scheduleSave, pushHistory, nodesRef, edgesRef]);

  // ── Edge reconnection — custom endpoint dots dispatch 'modemap-reconnect' ─────
  useEffect(() => {
    const h = (e: Event) => {
      const { id, end, nodeId } = (e as CustomEvent).detail as { id: string; end: 'source' | 'target'; nodeId: string };
      const ed = edgesRef.current.find(x => x.id === id);
      if (!ed) return;
      const otherEnd = end === 'source' ? ed.target : ed.source;
      const current = end === 'source' ? ed.source : ed.target;
      if (nodeId === otherEnd || nodeId === current) return; // self-loop or no change
      pushHistory();
      const newEdges = edgesRef.current.map(x => x.id === id
        ? { ...x, [end]: nodeId, [`${end}Handle`]: 'c' } : x);
      setEdges(newEdges); scheduleSave(nodesRef.current, newEdges);
    };
    window.addEventListener('modemap-reconnect', h);
    return () => window.removeEventListener('modemap-reconnect', h);
  }, [setEdges, scheduleSave, pushHistory, edgesRef, nodesRef]);

  // ── Auto layout ──────────────────────────────────────────────────────────────
  const onAutoLayout = useCallback(() => {
    if (nodes.length === 0) return;
    pushHistory();
    // With «Зоны» on, lay nodes out by type into the bands; otherwise dagre by edges.
    const laid = kind === 'couple' ? layoutCouple(nodes)
      : showZones ? layoutByZones(nodes) : autoLayout(nodes, edges);
    setNodes(laid); scheduleSave(laid, edges);
    // Only zoom out to fit — never magnify (maxZoom 1) so layout doesn't blow up the scale
    setTimeout(() => fitView({ padding: 0.2, duration: 400, maxZoom: 1 }), 50);
  }, [nodes, edges, setNodes, scheduleSave, pushHistory, fitView, showZones, kind]);

  // ── Node actions (toolbar + context menu) ────────────────────────────────────
  const duplicateNode = useCallback((id: string) => {
    const src = nodesRef.current.find(n => n.id === id);
    if (!src) return;
    pushHistory();
    const copy: FlowNode = {
      ...src, id: `${src.type}_${Date.now()}`,
      position: { x: src.position.x + 40, y: src.position.y + 40 },
      selected: false,
      data: { ...src.data },
    };
    const newNodes = [...nodesRef.current, copy];
    setNodes(newNodes); scheduleSave(newNodes, edgesRef.current);
  }, [setNodes, scheduleSave, pushHistory, nodesRef, edgesRef]);

  const removeNode = useCallback((id: string) => {
    pushHistory();
    const newNodes = nodesRef.current.filter(n => n.id !== id);
    const newEdges = edgesRef.current.filter(e => e.source !== id && e.target !== id);
    setNodes(newNodes); setEdges(newEdges);
    setSelectedNodeId(null);
    scheduleSave(newNodes, newEdges);
  }, [setNodes, setEdges, scheduleSave, pushHistory, nodesRef, edgesRef, setSelectedNodeId]);

  const renameNode = useCallback((id: string, label: string) => {
    pushHistory();
    const newNodes = nodesRef.current.map(n => n.id === id ? { ...n, data: { ...n.data, label } } : n);
    setNodes(newNodes); scheduleSave(newNodes, edgesRef.current);
  }, [setNodes, scheduleSave, pushHistory, nodesRef, edgesRef]);

  const patchNodeData = useCallback((id: string, partial: Record<string, unknown>) => {
    pushHistory();
    const newNodes = nodesRef.current.map(n => n.id === id ? { ...n, data: { ...n.data, ...partial } } : n);
    setNodes(newNodes); scheduleSave(newNodes, edgesRef.current);
  }, [setNodes, scheduleSave, pushHistory, nodesRef, edgesRef]);

  const nodeActions = useMemo<NodeActions>(() => ({
    duplicate: duplicateNode,
    remove: removeNode,
    edit: (id) => { setSelectedNodeId(id); setSelectedEdgeId(null); },
    rename: renameNode,
    patchData: patchNodeData,
  }), [duplicateNode, removeNode, renameNode, patchNodeData, setSelectedNodeId, setSelectedEdgeId]);

  // ── Templates & generate from conceptualization ──────────────────────────────
  const insertGraph = useCallback((ns: ModeMapNode[], es: { id: string; source: string; target: string; label?: string; data: { edgeType: string } }[]) => {
    pushHistory();
    const flowNs = toFlowNodes(ns);
    const flowEs = toFlowEdges(es as unknown as ModeMapEdge[]);
    const newNodes = [...nodesRef.current, ...flowNs];
    const newEdges = [...edgesRef.current, ...flowEs];
    setNodes(newNodes); setEdges(newEdges);
    scheduleSave(newNodes, newEdges);
    setTimeout(() => fitView({ padding: 0.2, duration: 400, maxZoom: 1 }), 50);
  }, [setNodes, setEdges, scheduleSave, pushHistory, nodesRef, edgesRef, fitView]);

  const onGenerateFromConcept = useCallback(async () => {
    try {
      const c = await api.getConceptualization(clientId);
      const ids: string[] = Array.isArray(c?.modeIds) ? c.modeIds : [];
      if (ids.length === 0) return;
      const existing = new Set(nodesRef.current.map(n => (n.data as { modeId?: string }).modeId).filter(Boolean));
      const ns: ModeMapNode[] = ids.filter(mid => !existing.has(mid)).map((mid, i) => {
        let type: ModeMapNode['type'] = 'custom';
        let sub: 'over' | 'avoid' | 'surr' | undefined;
        for (const g of MODE_GROUPS) {
          const meta = GROUP_TO_TYPE[g.id];
          if (meta && g.items.some(it => it.id === mid)) { type = meta.type; sub = meta.copingSubtype; break; }
        }
        const lib = getModeById(mid);
        const size = NODE_DEFAULT_SIZES[type] ?? {};
        return { id: `gen_${mid}_${Date.now()}_${i}`, type, position: { x: (i % 4) * 220, y: Math.floor(i / 4) * 200 },
          data: { modeId: mid, label: lib?.name ?? mid, ...(sub ? { copingSubtype: sub } : {}) }, ...size };
      });
      if (ns.length === 0) return;
      pushHistory();
      const merged = [...nodesRef.current, ...toFlowNodes(ns)];
      setNodes(merged); scheduleSave(merged, edgesRef.current);
      setTimeout(() => { const laid = autoLayout(nodesRef.current, edgesRef.current); setNodes(laid); fitView({ padding: 0.2, duration: 400, maxZoom: 1 }); }, 60);
    } catch { /* ignore */ }
  }, [clientId, setNodes, scheduleSave, pushHistory, nodesRef, edgesRef, fitView]);

  // ── Context menus ─────────────────────────────────────────────────────────────
  const onPaneContextMenu = useCallback((e: React.MouseEvent | MouseEvent) => {
    e.preventDefault();
    setMenu({ x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY, items: [
      { label: 'Авто-расположение', onClick: onAutoLayout },
      { label: 'Показать всё', onClick: () => fitView({ padding: 0.2, duration: 300 }) },
    ] });
  }, [onAutoLayout, fitView]);

  const onNodeContextMenu = useCallback((e: React.MouseEvent, node: FlowNode) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY, items: [
      { label: 'Редактировать', onClick: () => nodeActions.edit(node.id) },
      { label: 'Дублировать', onClick: () => duplicateNode(node.id) },
      { label: 'Удалить', onClick: () => removeNode(node.id), danger: true },
    ] });
  }, [nodeActions, duplicateNode, removeNode]);

  return (
    <div style={{ flex: 1, position: 'relative', background: 'var(--bg-elev)' }}>
      <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 10, fontSize: 12, color: 'var(--text-faint)', pointerEvents: 'none' }}>
        {saveStatus === 'saving' ? 'сохраняю…' : saveStatus === 'saved' ? '✓ сохранено' : ''}
      </div>
      {nodes.length === 0 && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 5 }}>
          <div style={{ width: 52, height: 52, borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--line)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)', marginBottom: 14 }}>
            <MMIcon name="map" size={26} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Карта режимов пуста</div>
          <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 6, textAlign: 'center', maxWidth: 260 }}>
            Кликай по режиму в панели слева или перетащи его на холст
          </div>
        </div>
      )}
      <NodeActionsContext.Provider value={nodeActions}>
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={NODE_TYPES as NodeTypes} edgeTypes={EDGE_TYPES}
        onNodesChange={onNodesChangeWithSave} onEdgesChange={onEdgesChange}
        onConnect={onConnect} onDrop={onDrop} onDragOver={onDragOver}
        isValidConnection={isValidConnection}
        connectionMode={ConnectionMode.Loose}
        connectionRadius={110}
        onNodeClick={(_, node) => { setSelectedNodeId(node.id); setSelectedEdgeId(null); }}
        onNodeDoubleClick={(_, node) => { setSelectedNodeId(node.id); setSelectedEdgeId(null); setTimeout(() => window.dispatchEvent(new CustomEvent('modemap-focus-name')), 30); }}
        onEdgeClick={(_, edge) => { setSelectedEdgeId(edge.id); setSelectedNodeId(null); }}
        onPaneClick={() => { setSelectedNodeId(null); setSelectedEdgeId(null); }}
        onPaneContextMenu={onPaneContextMenu} onNodeContextMenu={onNodeContextMenu}
        onMoveEnd={onMoveEnd}
        snapToGrid={snap} snapGrid={[20, 20]}
        selectionKeyCode="Shift" multiSelectionKeyCode={['Meta', 'Shift']}
        zoomOnPinch panOnScroll={false}
        fitView fitViewOptions={{ padding: 0.2 }} deleteKeyCode={null}
        nodesDraggable nodeDragThreshold={1}
      >
        <Background variant={BackgroundVariant.Dots} color="rgba(var(--fg-rgb),0.16)" gap={snap ? 20 : 22} size={1.5} />
        {kind === 'couple' ? <ModeMapCoupleLanes mapId={mapId} /> : showZones && <ModeMapZones />}

        {/* Toolbar — icon-only with hover tooltips */}
        <Panel position="top-left">
          <div style={{ display: 'flex', gap: 2, padding: 4, borderRadius: 9, alignItems: 'center', flexWrap: 'nowrap',
            background: 'var(--bg-elev)', border: '1px solid var(--line)',
            boxShadow: 'var(--shadow-2)' }}>
            {/* History */}
            <TbBtn label="Отменить (⌘Z)" disabled={!canUndo} onClick={onUndo}><MMIcon name="undo" size={17} /></TbBtn>
            <TbBtn label="Вернуть (⌘⇧Z)" disabled={!canRedo} onClick={onRedo}><MMIcon name="redo" size={17} /></TbBtn>
            <TbSep />
            {/* Zoom */}
            <TbBtn label="Отдалить" onClick={() => zoomOut()}><MMIcon name="minus" size={17} /></TbBtn>
            <TbBtn label="Приблизить" onClick={() => zoomIn()}><MMIcon name="plus" size={17} /></TbBtn>
            <TbBtn label="Показать всё" onClick={() => fitView({ padding: 0.2 })}><MMIcon name="fit" size={17} /></TbBtn>
            <TbSep />
            {/* Tools */}
            <TbBtn label="Разложить автоматически" onClick={onAutoLayout} disabled={nodes.length === 0}><MMIcon name="auto" size={17} /></TbBtn>
            <TbBtn label="Привязка к сетке" onClick={() => setSnap(s => !s)} active={snap}><MMIcon name="grid" size={17} /></TbBtn>
            <TbBtn label="Зоны: здоровый взрослый / копинги / детские и критики" onClick={toggleZones} active={showZones}><MMIcon name="zones" size={17} /></TbBtn>
            <div ref={tplWrapRef} style={{ position: 'relative' }}>
              <TbBtn label="Шаблоны и генерация" onClick={() => { setTplOpen(o => !o); setDlOpen(false); }} active={tplOpen} caret><MMIcon name="layers" size={17} /></TbBtn>
              {tplOpen && (
                <Dropdown anchorRef={tplWrapRef} onClose={() => setTplOpen(false)}>
                  <div style={dropHeadStyle}>Шаблоны</div>
                  {TEMPLATES.map(t => (
                    <button key={t.id} onClick={() => { const g = templateToGraph(t); insertGraph(g.nodes, g.edges); setTplOpen(false); }}
                      style={menuItemStyle}>{t.name}</button>
                  ))}
                  <div style={{ height: 1, background: 'var(--line)', margin: '4px 0' }} />
                  <button onClick={() => { onGenerateFromConcept(); setTplOpen(false); }} style={menuItemStyle}>
                    Из концептуализации клиента
                  </button>
                </Dropdown>
              )}
            </div>
            <div ref={schemasWrapRef} style={{ position: 'relative' }}>
              <TbBtn label="Схемы клиента — привязать к выбранному режиму" onClick={openSchemas} active={schemasOpen} caret><MMIcon name="target" size={17} /></TbBtn>
              {schemasOpen && (
                <Dropdown anchorRef={schemasWrapRef} onClose={() => setSchemasOpen(false)}>
                  <div style={dropHeadStyle}>Схемы клиента</div>
                  <div style={{ padding: '0 10px 6px', fontSize: 11, color: 'var(--text-faint)', lineHeight: 1.35 }}>
                    {selectedNodeId ? 'Нажми, чтобы привязать к выбранному режиму' : 'Сначала выбери режим на холсте'}
                  </div>
                  {clientSchemaIds === null && <div style={{ padding: '6px 10px', fontSize: 12, color: 'var(--text-faint)' }}>Загрузка…</div>}
                  {clientSchemaIds?.length === 0 && <div style={{ padding: '6px 10px', fontSize: 12, color: 'var(--text-faint)' }}>У клиента пока нет отмеченных схем</div>}
                  {clientSchemaIds?.map(sid => {
                    const s = getSchemaById(sid);
                    if (!s) return null;
                    return (
                      <button key={sid} disabled={!selectedNodeId}
                        onClick={() => { if (selectedNodeId) { patchNodeData(selectedNodeId, { schemaId: sid }); setSchemasOpen(false); } }}
                        style={{ ...menuItemStyle, display: 'flex', alignItems: 'center', gap: 8, opacity: selectedNodeId ? 1 : 0.55 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.domainColor, flexShrink: 0 }} />
                        <span>{s.emoji} {s.name}</span>
                      </button>
                    );
                  })}
                </Dropdown>
              )}
            </div>
            <TbBtn label="Подсказки: клиническая цепочка и советы" onClick={toggleGuide} active={showGuide}><MMIcon name="bulb" size={17} /></TbBtn>
            <TbBtn label="Легенда: формы и цвета" onClick={toggleLegend} active={showLegend}><MMIcon name="info" size={17} /></TbBtn>
            <TbSep />
            <div ref={dlWrapRef} style={{ position: 'relative' }}>
              <TbBtn label="Скачать карту (PNG / PDF)" onClick={() => { setDlOpen(o => !o); setTplOpen(false); }}
                active={dlOpen} caret disabled={nodes.length === 0}><MMIcon name="download" size={17} /></TbBtn>
              {dlOpen && (
                <Dropdown anchorRef={dlWrapRef} onClose={() => setDlOpen(false)}>
                  <button disabled={exporting} onClick={() => { onExportPng(); setDlOpen(false); }} style={menuItemStyle}>Картинка PNG</button>
                  <button disabled={exporting} onClick={() => { onExportPdf(); setDlOpen(false); }} style={menuItemStyle}>Документ PDF</button>
                </Dropdown>
              )}
            </div>
            {isDesktop && (
              <div ref={keysWrapRef} style={{ position: 'relative' }}>
                <TbBtn label="Горячие клавиши" onClick={() => setKeysOpen(o => !o)} active={keysOpen}><MMIcon name="keyboard" size={17} /></TbBtn>
                {keysOpen && (
                  <Dropdown anchorRef={keysWrapRef} onClose={() => setKeysOpen(false)}>
                    <div style={dropHeadStyle}>Горячие клавиши</div>
                    {([
                      ['⌘Z / Ctrl+Z', 'Отменить'],
                      ['⌘⇧Z / Ctrl+Y', 'Вернуть'],
                      ['⌘D', 'Дублировать ноду'],
                      ['Backspace', 'Удалить выбранное'],
                      ['Shift + рамка', 'Выделить несколько'],
                      ['Двойной клик', 'Переименовать'],
                      ['Esc', 'Снять выделение'],
                    ] as [string, string][]).map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 14, padding: '5px 10px', fontSize: 12 }}>
                        <span style={{ color: 'var(--text-sub)' }}>{v}</span>
                        <kbd style={{ color: 'var(--text)', fontFamily: 'inherit', fontSize: 11.5, background: 'var(--surface-2)', padding: '1px 6px', borderRadius: 4, whiteSpace: 'nowrap' }}>{k}</kbd>
                      </div>
                    ))}
                  </Dropdown>
                )}
              </div>
            )}
          </div>
        </Panel>

        {showLegend && (
          <Panel position="bottom-left">
            <ModeMapLegend onClose={toggleLegend} />
          </Panel>
        )}
        {showGuide && (
          <Panel position="bottom-right">
            <ModeMapGuide nodes={nodes} kind={kind} onAdd={addNodeFromGuide} onOpenNeed={onOpenNeed} onClose={toggleGuide} />
          </Panel>
        )}
      </ReactFlow>
      </NodeActionsContext.Provider>

      {menu && <ModeMapContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />}
    </div>
  );
}

const menuItemStyle: React.CSSProperties = {
  display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px',
  borderRadius: 5, fontSize: 12.5, cursor: 'pointer', background: 'none', border: 'none', color: 'var(--text)',
};

// Icon-only toolbar button with a custom hover tooltip (no cramped text labels)
function TbBtn({ children, label, onClick, disabled, active, caret }: {
  children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; active?: boolean; caret?: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div style={{ position: 'relative', display: 'flex' }}>
      <button onClick={onClick} disabled={disabled}
        style={{ minWidth: 32, height: 30, padding: caret ? '0 6px 0 8px' : '0 7px', borderRadius: 6, border: 'none',
          cursor: disabled ? 'default' : 'pointer', gap: 3,
          background: active ? 'var(--accent-soft)' : hover && !disabled ? 'var(--surface-2)' : 'none', fontSize: 15, lineHeight: 1,
          color: disabled ? 'var(--text-ghost)' : active ? 'var(--accent)' : 'var(--text-sub)',
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
        {children}{caret && <MMIcon name="caret" size={11} style={{ opacity: 0.65, marginLeft: 1 }} />}
      </button>
      {hover && !disabled && (
        <div style={{ position: 'absolute', top: 36, left: '50%', transform: 'translateX(-50%)', zIndex: 40,
          background: 'var(--text)', color: 'var(--bg)', fontSize: 11, padding: '3px 7px', borderRadius: 5,
          whiteSpace: 'nowrap', pointerEvents: 'none', boxShadow: 'var(--shadow-2)' }}>
          {label}
        </div>
      )}
    </div>
  );
}
function TbSep() {
  return <div style={{ width: 1, background: 'var(--line)', margin: '4px 2px' }} />;
}

// Anchored to its trigger button and rendered fixed, clamped inside the viewport —
// so it never gets clipped or pushed off-screen by the toolbar's position.
function Dropdown({ children, onClose, anchorRef }: {
  children: React.ReactNode; onClose: () => void; anchorRef: React.RefObject<HTMLElement | null>;
}) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const r = anchorRef.current?.getBoundingClientRect();
    if (!r) return;
    const WIDTH = 220, MARGIN = 8;
    let left = r.left;
    if (left + WIDTH > window.innerWidth - MARGIN) left = window.innerWidth - MARGIN - WIDTH;
    if (left < MARGIN) left = MARGIN;
    setPos({ left, top: r.bottom + 4 });
  }, [anchorRef]);
  return (
    <>
      <div role="button" tabIndex={0} aria-label="Закрыть" onClick={onClose}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClose(); } }}
        style={{ position: 'fixed', inset: 0, zIndex: 39 }} />
      {pos && (
        <div style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 40, width: 220,
          background: 'var(--bg-elev)', border: '1px solid var(--line)', borderRadius: 8,
          padding: 4, boxShadow: 'var(--shadow-2)' }}>
          {children}
        </div>
      )}
    </>
  );
}

const dropHeadStyle: React.CSSProperties = {
  padding: '4px 8px', fontSize: 10, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase',
};
