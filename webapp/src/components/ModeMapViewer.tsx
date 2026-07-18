import { ReactFlow, ReactFlowProvider, Background, BackgroundVariant, Panel, useReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useEffect, useState } from 'react';
import { api, type ModeMapMeta, type ModeMapFull } from '../api';
import { NODE_TYPES } from './modeMapRegistry';
import { EDGE_TYPES } from './modeMapRegistry';
import { toFlowNodes, toFlowEdges } from './modeMapFlow';
import { ModeMapLegend } from './ModeMapLegend';
import { MMIcon } from './modeMapIcons';

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
        <div style={{ display: 'flex', gap: 2, padding: 4, borderRadius: 9, background: 'var(--bg-elev)',
          border: '1px solid var(--line)', boxShadow: 'var(--shadow-2)' }}>
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
    <button onClick={onClick} style={{ width: 32, height: 30, borderRadius: 6, border: 'none', cursor: 'pointer',
      background: active ? 'var(--accent-soft)' : 'none', color: active ? 'var(--accent)' : 'var(--text-sub)',
      fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{children}</button>
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
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, color: 'var(--text-sub)' }}>
        <div style={{ width: 52, height: 52, borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)' }}>
          <MMIcon name="map" size={26} />
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Карты режимов пока нет</div>
        <div style={{ fontSize: 13, textAlign: 'center', maxWidth: 300, lineHeight: 1.5 }}>
          Терапевт создаёт её на сессии — она появится здесь.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {maps.length > 1 && (
        <div style={{ display: 'flex', gap: 6, padding: '8px 12px', overflowX: 'auto', flexShrink: 0,
          borderBottom: '1px solid var(--line)' }}>
          {maps.map(m => (
            <button key={m.id} onClick={() => select(m.id)}
              style={{ padding: '5px 12px', borderRadius: 7, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                fontWeight: active?.id === m.id ? 600 : 400,
                border: active?.id === m.id ? '1px solid var(--line)' : '1px solid transparent',
                background: active?.id === m.id ? 'var(--surface-3)' : 'none',
                color: active?.id === m.id ? 'var(--text)' : 'var(--text-sub)' }}>
              {m.kind === 'personality' ? '🧭' : m.kind === 'couple' ? '💞' : '🎯'} {m.title}
            </button>
          ))}
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {loading && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)' }}>Загрузка…</div>}
        {active && (
          <ReactFlowProvider>
            <div style={{ width: '100%', height: '100%' }}><Canvas key={active.id} map={active} /></div>
          </ReactFlowProvider>
        )}
      </div>
    </div>
  );
}
