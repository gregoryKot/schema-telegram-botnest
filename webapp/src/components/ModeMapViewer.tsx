import { FadeSeg } from './FadeSeg';
import { ReactFlow, ReactFlowProvider, Background, BackgroundVariant, Panel, useReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useEffect, useState } from 'react';
import { api, reportClientError, type ModeMapMeta, type ModeMapFull } from '../api';
import { NODE_TYPES, EDGE_TYPES } from './modeMapRegistry';
import { useViewerFit } from './modeMap/useViewerFit';
import { ClientWheelProvider, type ClientModeMap } from './modeMap/ClientWheelProvider';
import { toFlowNodes, toFlowEdges } from './modeMapFlow';
import { ModeMapLegend } from './ModeMapLegend';
import { ModeMapSkeleton } from './modeMap/ModeMapSkeleton';
import { MMIcon } from './modeMapIcons';
import { PaperEmpty } from './art/PaperEmpty';
import { useTr } from '../utils/addressForm';
import '../styles/sheet-modemap.css';

function Canvas({ map }: { map: ModeMapFull }) {
  const { zoomIn, zoomOut } = useReactFlow();
  const { showAll } = useViewerFit();
  const [legend, setLegend] = useState(false);
  return (
    <ReactFlow
      defaultNodes={toFlowNodes(map.nodes)} defaultEdges={toFlowEdges(map.edges)}
      nodeTypes={NODE_TYPES as never} edgeTypes={EDGE_TYPES}
      nodesDraggable={false} nodesConnectable={false} elementsSelectable={false}
      minZoom={0.2} proOptions={{ hideAttribution: true }} className="mm2-view"
    >
      <Background variant={BackgroundVariant.Dots} color="rgba(var(--fg-rgb),0.16)" gap={22} size={1.5} />
      <Panel position="top-left">
        <div className="ds-card mm2-toolbar">
          <ViewBtn onClick={() => zoomOut()}><MMIcon name="minus" size={17} /></ViewBtn>
          <ViewBtn onClick={() => zoomIn()}><MMIcon name="plus" size={17} /></ViewBtn>
          <ViewBtn onClick={showAll}><MMIcon name="fit" size={17} /></ViewBtn>
          <ViewBtn onClick={() => setLegend(l => !l)} active={legend}><MMIcon name="info" size={17} /></ViewBtn>
        </div>
      </Panel>
      {legend && <Panel position="bottom-left"><ModeMapLegend onClose={() => setLegend(false)} /></Panel>}
    </ReactFlow>
  );
}

function ViewBtn({ children, onClick, active }: { children: React.ReactNode; onClick: () => void; active?: boolean }) {
  return <button onClick={onClick} className={`ds-btn ds-btn--icon mm2-tb-btn${active ? ' is-active' : ''}`}>{children}</button>;
}

const reportViewerFailure = (what: string) => reportClientError({ message: `mode map viewer: ${what} load failed`, section: 'modeMap.viewer' });

/** Read-only viewer of the client's own mode maps. */
export function ModeMapViewer() {
  const tr = useTr();
  const [maps, setMaps] = useState<ModeMapMeta[]>([]);
  const [active, setActive] = useState<ClientModeMap | null>(null);
  const [loading, setLoading] = useState(true);
  // Сбой ≠ пусто: отказ списка — не «Карты режимов пока нет», отказ карты — не пустой холст.
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api.listMyModeMaps()
      .then(list => { setMaps(list); if (list.length) void select(list[0].id); else setLoading(false); }) // select ловит сбой сам
      .catch(() => { setFailed(true); setLoading(false); reportViewerFailure('list'); });
  }, []);

  async function select(id: number) {
    setLoading(true);
    setFailed(false);
    try { setActive(await api.getMyModeMap(id)); } catch { setFailed(true); reportViewerFailure('map'); } finally { setLoading(false); }
  }

  if (!loading && !failed && maps.length === 0) {
    return (
      <div className="mm2-center">
        <PaperEmpty title="Карты режимов пока нет">Терапевт создаёт её на сессии — она появится здесь.</PaperEmpty>
      </div>
    );
  }

  return (
    <div className="mm2-fill">
      {maps.length > 1 && (
        <div className="mm2-bar">
          <FadeSeg role="group" label="Карты режимов" watch={`${active?.id}:${maps.length}`}>
          {maps.map(m => (
            <button key={m.id} type="button" onClick={() => select(m.id)} aria-pressed={active?.id === m.id}
              className={`ds-seg-btn${active?.id === m.id ? ' is-active' : ''}`}>{m.title}</button>
          ))}
          </FadeSeg>
        </div>
      )}
      {failed && (
        <p role="alert" className="mm2-create-err">
          {tr('Не удалось загрузить карту режимов. Проверь соединение и попробуй ещё раз', 'Не удалось загрузить карту режимов. Проверьте соединение и попробуйте ещё раз')}
        </p>
      )}
      <div className="mm2-view-body">
        {loading && <div className="mm2-view-load"><ModeMapSkeleton /></div>}
        {active && (
          <ReactFlowProvider>
            <ClientWheelProvider ratings={active.needRatings}><Canvas key={active.id} map={active} /></ClientWheelProvider>
          </ReactFlowProvider>
        )}
      </div>
    </div>
  );
}
