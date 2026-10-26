import { useCallback, useEffect, useRef, useState } from 'react';
import { api, reportClientError } from '../api';
import { fromFlowNodes, fromFlowEdges } from './modeMapFlow';
import type { FlowNode, FlowEdge } from './modeMapFlow';
import { usePendingSave } from '../../../shared/src/utils/usePendingSave';

type Scheduled = { ns: FlowNode[]; es: FlowEdge[] };

// Дебаунсит api.updateModeMap на 1200мс и следит за статусом сохранения.
// Механика отложенного сохранения — общая (shared/src/utils/usePendingSave.ts,
// та же, что у концептуализации клиента): досылка при размонтировании,
// pagehide и скрытии вкладки.
//
// РЕГРЕССИЯ: раньше таймер не отменялся при размонтировании — уход с экрана
// раньше 1200мс либо терял правку, либо звал setState на пропавшем дереве
// (гонка, обнажённая vitest --coverage: «unhandled rejection после teardown»).
// Досылка при уходе — fire-and-forget без setSaveStatus (звать его уже
// некому); отказ уходит в телеметрию, а не молча (правило про тихий catch).
export function useModeMapAutosave(
  mapId: number,
  nodesRef: React.MutableRefObject<FlowNode[]>,
  edgesRef: React.MutableRefObject<FlowEdge[]>,
) {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  async function send(id: number, { ns, es }: Scheduled, { leaving }: { leaving: boolean }) {
    // При уходе — САМЫЕ СВЕЖИЕ узлы и связи (рефы), а не аргументы последнего
    // scheduleSave: перетаскивание обновляет узлы без нового scheduleSave.
    // Редактор смонтирован под key={map.id}, так что рефы — этой же карты.
    if (leaving) {
      return api.updateModeMap(id, { nodes: fromFlowNodes(nodesRef.current), edges: fromFlowEdges(edgesRef.current) }, { keepalive: true });
    }
    if (isMounted.current) setSaveStatus('saving');
    try {
      await api.updateModeMap(id, { nodes: fromFlowNodes(ns), edges: fromFlowEdges(es) });
      if (isMounted.current) setSaveStatus('saved');
    } catch { if (isMounted.current) setSaveStatus('idle'); }
  }

  const saver = usePendingSave<number, Scheduled>({
    delayMs: 1200,
    send,
    onLeaveError: () => reportClientError({ message: 'mode map unmount save failed', section: 'modeMap' }),
  });

  const scheduleSave = useCallback((ns: FlowNode[], es: FlowEdge[]) => {
    setSaveStatus('idle');
    saver.schedule(mapId, { ns, es });
  }, [mapId, saver]);

  return { saveStatus, scheduleSave };
}
