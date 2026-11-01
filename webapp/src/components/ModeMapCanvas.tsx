import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow, Background, BackgroundVariant, Panel,
  addEdge, useReactFlow, useNodesInitialized, ConnectionMode,
  type Connection, type NodeTypes, type Viewport,
  type useNodesState, type useEdgesState,
} from '@xyflow/react';
import { type ModeMapNode, type ModeMapEdge, type ModeMapKind, type UserId } from '../api';
import { NODE_TYPES, EDGE_TYPES } from './modeMapRegistry';
import { NODE_DEFAULT_SIZES, DRAG_TYPE } from './modeMapData';
import { SaveStatusLine, type SaveStatus } from '../../../shared/src/therapy/SaveStatusLine';
import '../styles/sheet-modemap.css';
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
import { MMIcon } from './modeMapIcons';
import { TbBtn, TbSep } from './modeMap/ToolbarControls';
import { Dropdown } from './Dropdown';
import { DownloadMenu } from './modeMap/DownloadMenu';
import { useHubDrag } from './modeMap/useHubDrag';
import { useGenerateFromConcept } from './modeMap/useGenerateFromConcept';
import { CanvasEmpty } from './modeMap/CanvasEmpty';
import { useCanvasSpace } from './modeMap/useCanvasSpace';

export interface CanvasProps {
  clientId: UserId; mapId: number; kind: ModeMapKind;
  nodes: FlowNode[]; edges: FlowEdge[];
  setNodes: ReturnType<typeof useNodesState<FlowNode>>[1];
  setEdges: ReturnType<typeof useEdgesState<FlowEdge>>[1];
  onNodesChange: ReturnType<typeof useNodesState<FlowNode>>[2];
  onEdgesChange: ReturnType<typeof useEdgesState<FlowEdge>>[2];
  setSelectedNodeId: (id: string | null) => void;
  setSelectedEdgeId: (id: string | null) => void;
  saveStatus: SaveStatus; savedAt: Date | null; onRetrySave: () => void; // строка статуса — SaveStatusLine (issue #879)
  scheduleSave: (ns: FlowNode[], es: FlowEdge[]) => void;
  pushHistory: () => void;
  nodesRef: React.MutableRefObject<FlowNode[]>;
  edgesRef: React.MutableRefObject<FlowEdge[]>;
  onUndo: () => void; onRedo: () => void;
  canUndo: boolean; canRedo: boolean;
}

export function ModeMapCanvas({ clientId, mapId, kind, nodes, edges, setNodes, setEdges, onNodesChange, onEdgesChange,
  setSelectedNodeId, setSelectedEdgeId, saveStatus, savedAt, onRetrySave, scheduleSave,
  pushHistory, nodesRef, edgesRef, onUndo, onRedo, canUndo, canRedo }: CanvasProps) {
  const { screenToFlowPosition, zoomIn, zoomOut, setViewport } = useReactFlow();
  const space = useCanvasSpace(); // свободное место и «Показать всё» с учётом панелей

  const [snap, setSnap] = useState(false);
  const [showLegend, setShowLegend] = useState(() => localStorage.getItem('modemap_legend') === '1');
  // Сохранённый выбор — как есть; без него подсказки открыты только на почти пустой карте
  // (карта приходит вместе с редактором, ключ — id карты: узлы известны на монтировании).
  const [showGuide, setShowGuide] = useState(() => {
    const saved = localStorage.getItem('modemap_guide');
    return saved === null ? nodes.length < 3 : saved !== '0';
  });
  const [showZones, setShowZones] = useState(() => localStorage.getItem('modemap_zones') === '1');
  const [tplOpen, setTplOpen] = useState(false);
  const [dlOpen, setDlOpen] = useState(false);
  const [keysOpen, setKeysOpen] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);
  const tplWrapRef = useRef<HTMLDivElement>(null);
  const keysWrapRef = useRef<HTMLDivElement>(null);

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
  const nodesReady = useNodesInitialized();
  const onMoveEnd = useCallback((_: unknown, vp: Viewport) => {
    try { localStorage.setItem(vpKey, JSON.stringify(vp)); } catch { /* ignore */ }
  }, [vpKey]);
  // Открытие карты: сохранённый вид, иначе «Показать всё» с отступами под панели
  // (у fitView-пропа их нет — подсказки справа закрывали фигуры). Пустую карту
  // не подгоняем: первая фигура ложится на свободное место без зума.
  useEffect(() => {
    if (restoredVp.current) return;
    let saved: Viewport | null = null;
    try { saved = JSON.parse(localStorage.getItem(vpKey) ?? 'null'); } catch { /* ignore */ }
    if (saved) { const vp = saved; restoredVp.current = true; setTimeout(() => setViewport(vp), 0); }
    else if (nodes.length === 0) restoredVp.current = true;
    else if (nodesReady) { restoredVp.current = true; space.fit(0); }
  }, [vpKey, setViewport, nodesReady, nodes.length, space]);

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

  // Add a node from the guidance panel — on a free spot of the visible area
  const addNodeFromGuide = useCallback((partial: Omit<ModeMapNode, 'position'>) => {
    const [pos] = space.place(nodesRef.current);
    const defaultSize = NODE_DEFAULT_SIZES[partial.type] ?? {};
    pushHistory();
    const newNodes = [...nodesRef.current, { id: partial.id, type: partial.type, position: pos, data: partial.data as Record<string, unknown>, ...defaultSize }];
    setNodes(newNodes); scheduleSave(newNodes, edgesRef.current);
  }, [space, setNodes, scheduleSave, pushHistory, nodesRef, edgesRef]);

  // Open the unmet-need field on the Vulnerable Child node (from the guide's step 6)
  const onOpenNeed = useCallback(() => {
    const child = nodesRef.current.find(n => n.type === 'child') ?? nodesRef.current.find(n => n.type === 'custom');
    if (!child) return;
    setSelectedNodeId(child.id); setSelectedEdgeId(null);
    setTimeout(() => window.dispatchEvent(new CustomEvent('modemap-focus-need')), 40);
  }, [nodesRef, setSelectedNodeId, setSelectedEdgeId]);

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
    setTimeout(() => space.fit(400), 50);
  }, [nodes, edges, setNodes, scheduleSave, pushHistory, space, showZones, kind]);

  // ── Node actions (toolbar + context menu) ────────────────────────────────────
  const duplicateNode = useCallback((id: string) => {
    const src = nodesRef.current.find(n => n.id === id);
    if (!src) return;
    pushHistory();
    const copy: FlowNode = {
      ...src, id: `${src.type}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, // суффикс: два дубля в одну мс делили id
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
  const insertGraph = useCallback((ns: ModeMapNode[], es: { id: string; source: string; target: string; label?: string; data?: object }[]) => {
    pushHistory();
    const flowNs = toFlowNodes(ns);
    const flowEs = toFlowEdges(es as unknown as ModeMapEdge[]);
    const newNodes = [...nodesRef.current, ...flowNs];
    const newEdges = [...edgesRef.current, ...flowEs];
    setNodes(newNodes); setEdges(newEdges);
    scheduleSave(newNodes, newEdges);
    setTimeout(() => space.fit(400), 50);
  }, [setNodes, setEdges, scheduleSave, pushHistory, nodesRef, edgesRef, space]);

  const fromConcept = useGenerateFromConcept({ clientId, nodesRef, edgesRef, insert: insertGraph });
  const hubDrag = useHubDrag({ nodesRef, setNodes });

  // ── Context menus ─────────────────────────────────────────────────────────────
  const onPaneContextMenu = useCallback((e: React.MouseEvent | MouseEvent) => {
    e.preventDefault();
    setMenu({ x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY, items: [
      { label: 'Авто-расположение', onClick: onAutoLayout },
      { label: 'Показать всё', onClick: () => space.fit() },
    ] });
  }, [onAutoLayout, space]);

  const onNodeContextMenu = useCallback((e: React.MouseEvent, node: FlowNode) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY, items: [
      { label: 'Редактировать', onClick: () => nodeActions.edit(node.id) },
      { label: 'Дублировать', onClick: () => duplicateNode(node.id) },
      { label: 'Удалить', onClick: () => removeNode(node.id), danger: true },
    ] });
  }, [nodeActions, duplicateNode, removeNode]);

  return (
    <div className="mm2-canvas" style={{ flex: 1, position: 'relative', background: 'var(--surface)' }}>
      <div className="mm2-status">
        {fromConcept.failed ? <span role="alert" className="is-err">Не получилось собрать схему из концептуализации</span>
          : <SaveStatusLine status={saveStatus} savedAt={savedAt} onRetry={onRetrySave} align="right" />}
      </div>
      {nodes.length === 0 && <CanvasEmpty />}
      <NodeActionsContext.Provider value={nodeActions}>
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={NODE_TYPES as NodeTypes} edgeTypes={EDGE_TYPES}
        onNodesChange={onNodesChangeWithSave} onEdgesChange={onEdgesChange}
        onConnect={onConnect} onDrop={onDrop} onDragOver={onDragOver}
        onNodeDragStart={hubDrag.onNodeDragStart} onNodeDrag={hubDrag.onNodeDrag}
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
        deleteKeyCode={null}
        nodesDraggable nodeDragThreshold={1}
      >
        <Background variant={BackgroundVariant.Dots} color="rgba(var(--fg-rgb),0.16)" gap={snap ? 20 : 22} size={1.5} />
        {kind === 'couple' ? <ModeMapCoupleLanes mapId={mapId} /> : showZones && <ModeMapZones />}

        {/* Toolbar — icon-only with hover tooltips */}
        <Panel position="top-left">
          <div className="ds-card mm2-toolbar">
            {/* History */}
            <TbBtn label="Отменить (⌘Z)" disabled={!canUndo} onClick={onUndo}><MMIcon name="undo" size={17} /></TbBtn>
            <TbBtn label="Вернуть (⌘⇧Z)" disabled={!canRedo} onClick={onRedo}><MMIcon name="redo" size={17} /></TbBtn>
            <TbSep />
            {/* Zoom */}
            <TbBtn label="Отдалить" onClick={() => zoomOut()}><MMIcon name="minus" size={17} /></TbBtn>
            <TbBtn label="Приблизить" onClick={() => zoomIn()}><MMIcon name="plus" size={17} /></TbBtn>
            <TbBtn label="Показать всё" onClick={() => space.fit()}><MMIcon name="fit" size={17} /></TbBtn>
            <TbSep />
            {/* Tools */}
            <TbBtn label="Разложить автоматически" onClick={onAutoLayout} disabled={nodes.length === 0}><MMIcon name="auto" size={17} /></TbBtn>
            <TbBtn label="Привязка к сетке" onClick={() => setSnap(s => !s)} active={snap}><MMIcon name="grid" size={17} /></TbBtn>
            <TbBtn label="Зоны: Здоровый Взрослый / копинги / детские и критики" onClick={toggleZones} active={showZones}><MMIcon name="zones" size={17} /></TbBtn>
            <div ref={tplWrapRef} className="mm2-tb">
              <TbBtn label="Шаблоны и генерация" onClick={() => { setTplOpen(o => !o); setDlOpen(false); }} active={tplOpen} caret><MMIcon name="layers" size={17} /></TbBtn>
              {tplOpen && (
                <Dropdown anchorRef={tplWrapRef} onClose={() => setTplOpen(false)}>
                  <div className="mm2-drop-head">Шаблоны</div>
                  {TEMPLATES.map(t => (
                    <button key={t.id} onClick={() => { const g = templateToGraph(t); insertGraph(g.nodes, g.edges); setTplOpen(false); }}
                      className="mm2-item">{t.name}</button>
                  ))}
                  <div className="mm2-drop-sep" />
                  <button onClick={() => { void fromConcept.generate(); setTplOpen(false); }} className="mm2-item">
                    Из концептуализации клиента
                  </button>
                </Dropdown>
              )}
            </div>
            <TbBtn label="Подсказки: клиническая цепочка и советы" onClick={toggleGuide} active={showGuide}><MMIcon name="bulb" size={17} /></TbBtn>
            <TbBtn label="Легенда: формы и цвета" onClick={toggleLegend} active={showLegend}><MMIcon name="info" size={17} /></TbBtn>
            <TbSep />
            <DownloadMenu nodes={nodes} open={dlOpen}
              onToggle={() => { setDlOpen(o => !o); setTplOpen(false); }}
              onClose={() => setDlOpen(false)} />
            {isDesktop && (
              <div ref={keysWrapRef} className="mm2-tb">
                <TbBtn label="Горячие клавиши" onClick={() => setKeysOpen(o => !o)} active={keysOpen}><MMIcon name="keyboard" size={17} /></TbBtn>
                {keysOpen && (
                  <Dropdown anchorRef={keysWrapRef} onClose={() => setKeysOpen(false)}>
                    <div className="mm2-drop-head">Горячие клавиши</div>
                    {([
                      ['⌘Z / Ctrl+Z', 'Отменить'],
                      ['⌘⇧Z / Ctrl+Y', 'Вернуть'],
                      ['⌘D', 'Дублировать ноду'],
                      ['Backspace', 'Удалить выбранное'],
                      ['Shift + рамка', 'Выделить несколько'],
                      ['Двойной клик', 'Переименовать'],
                      ['Esc', 'Снять выделение'],
                    ] as [string, string][]).map(([k, v]) => (
                      <div key={k} className="mm2-kbd-row">
                        <span>{v}</span>
                        <kbd className="mm2-kbd">{k}</kbd>
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
