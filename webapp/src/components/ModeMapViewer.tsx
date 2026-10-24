import { ReactFlow, ReactFlowProvider, Background, BackgroundVariant, Panel, useReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useEffect, useState } from 'react';
import { api, type ModeMapMeta, type ModeMapFull } from '../api';
import { NODE_TYPES } from './modeMapRegistry';
import { EDGE_TYPES } from './modeMapRegistry';
import { toFlowNodes, toFlowEdges } from './modeMapFlow';
import { ModeMapLegend } from './ModeMapLegend';
import { MMIcon } from './modeMapIcons';
import '../styles/sheet-modemap.css';

function Canvas({ map }: { map: ModeMapFull }) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const [legend, setLegend] = useState(false);
  return (
    <ReactFlow
      nodes={toFlowNodes(map.nodes)} edges={toFlowEdges(map.edges)}
      nodeTypes={NODE_TYPES as never} edgeTypes={EDGE_TYPES}
      nodesDraggable={false} nodesConnectable={false} elementsSelectable={false}
      fitView fitViewOptions={{ padding: 0.2 }} minZoom={0.2} proOptions={{ hideAttribution: true }}
    >
      <Background variant={BackgroundVariant.Dots} color="rgba(var(--fg-rgb),0.16)" gap={22} size={1.5} />
      <Panel position="top-left">
        <div className="ds-card mm2-toolbar">
          <ViewBtn onClick={() => zoomOut()}><MMIcon name="minus" size={17} /></ViewBtn>
          <ViewBtn onClick={() => zoomIn()}><MMIcon name="plus" size={17} /></ViewBtn>
          <ViewBtn onClick={() => fitView({ padding: 0.2 })}><MMIcon name="fit" size={17} /></ViewBtn>
          <ViewBtn onClick={() => setLegend(l => !l)} active={legend}><MMIcon name="info" size={17} /></ViewBtn>
        </div>
      </Panel>
      {legend && <Panel position="bottom-left"><ModeMapLegend onClose={() => setLegend(false)} /></Panel>}
    </ReactFlow>
  );
}

function ViewBtn({ children, onClick, active }: { children: React.ReactNode; onClick: () => void; active?: boolean }) {
  return (
    <button onClick={onClick} className={`ds-btn ds-btn--icon mm2-tb-btn${active ? ' is-active' : ''}`}>{children}</button>
  );
}

/** Read-only viewer of the client's own mode maps. */
export function ModeMapViewer() {
  const [maps, setMaps] = useState<ModeMapMeta[]>([]);
  const [active, setActive] = useState<ModeMapFull | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listMyModeMaps()
      .then(list => { setMaps(list); if (list.length) select(list[0].id); else setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function select(id: number) {
    setLoading(true);
    try { setActive(await api.getMyModeMap(id)); } finally { setLoading(false); }
  }

  if (!loading && maps.length === 0) {
    return (
      <div className="mm2-center">
        <div className="mm2-empty-ico"><MMIcon name="map" size={26} /></div>
        <div className="mm2-empty-title">Карты режимов пока нет</div>
        <div className="mm2-empty-sub">
          Терапевт создаёт её на сессии — она появится здесь.
        </div>
      </div>
    );
  }

  return (
    <div className="mm2-fill">
      {maps.length > 1 && (
        <div className="mm2-bar">
          {maps.map(m => (
            <button key={m.id} onClick={() => select(m.id)}
              className={`ds-card mm2-map mm2-map-btn${active?.id === m.id ? ' is-active' : ''}`}>
              {m.title}
            </button>
          ))}
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {loading && <div className="mm2-loading" style={{ position: 'absolute', inset: 0 }}>Загрузка…</div>}
        {active && (
          <ReactFlowProvider>
            <div style={{ width: '100%', height: '100%' }}><Canvas key={active.id} map={active} /></div>
          </ReactFlowProvider>
        )}
      </div>
    </div>
  );
}
