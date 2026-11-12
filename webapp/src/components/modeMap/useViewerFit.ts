import { useCallback, useEffect, useRef } from 'react';
import { useNodesInitialized, useReactFlow, useStoreApi } from '@xyflow/react';
import { FIT_PADDING, READABLE_ZOOM, mainNodeId, viewerFitPlan } from './viewerFit';

/**
 * Вид карты у клиента: при открытии — целиком или читаемым фрагментом вокруг главной фигуры
 * (viewerFit.ts); `showAll` — кнопка «показать всё». Ждёт, пока холст измерит фигуры.
 */
export function useViewerFit(): { showAll: () => void } {
  const { fitView, getNodes, getEdges, getNodesBounds, setCenter } = useReactFlow();
  const store = useStoreApi();
  const ready = useNodesInitialized();
  const opened = useRef(false);

  const showAll = useCallback(() => { void fitView({ padding: FIT_PADDING }); }, [fitView]);

  useEffect(() => {
    if (!ready || opened.current) return;
    opened.current = true;
    const nodes = getNodes();
    const pane = store.getState().domNode?.getBoundingClientRect();
    if (!pane || nodes.length === 0) return;
    const bounds = getNodesBounds(nodes);
    const main = nodes.find((n) => n.id === mainNodeId(nodes, getEdges()));
    if (!main || viewerFitPlan({ w: pane.width, h: pane.height }, { w: bounds.width, h: bounds.height }) === 'all') { showAll(); return; }
    const box = getNodesBounds([main]);
    void setCenter(box.x + box.width / 2, box.y + box.height / 2, { zoom: READABLE_ZOOM });
  }, [ready, getNodes, getEdges, getNodesBounds, setCenter, store, showAll]);

  return { showAll };
}
