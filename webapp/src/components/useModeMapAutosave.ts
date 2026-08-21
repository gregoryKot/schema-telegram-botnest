import { useCallback, useEffect, useRef, useState } from 'react';
import { api, reportClientError } from '../api';
import { fromFlowNodes, fromFlowEdges } from './modeMapFlow';
import type { FlowNode, FlowEdge } from './modeMapFlow';

// Дебаунсит api.updateModeMap на 1200мс и следит за статусом сохранения.
//
// РЕГРЕССИЯ: раньше таймер не отменялся при размонтировании — уход с экрана
// раньше 1200мс либо терял правку, либо звал setState на пропавшем дереве
// (гонка, обнажённая vitest --coverage: «unhandled rejection после teardown»).
// Чинится флагом isMounted (setState после ухода — no-op) и cleanup-эффектом,
// который отменяет таймер и досылает несохранённое немедленно,
// fire-and-forget — setSaveStatus здесь звать уже некому. Отказ уходит в
// телеметрию, а не молча (правило про тихий catch, CLAUDE.md).
export function useModeMapAutosave(
  mapId: number,
  nodesRef: React.MutableRefObject<FlowNode[]>,
  edgesRef: React.MutableRefObject<FlowEdge[]>,
) {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(true);

  const scheduleSave = useCallback((ns: FlowNode[], es: FlowEdge[]) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveStatus('idle');
    saveTimer.current = setTimeout(async () => {
      saveTimer.current = null; // сработал — больше не «взведён» для unmount-флаша
      if (isMounted.current) setSaveStatus('saving');
      try {
        await api.updateModeMap(mapId, { nodes: fromFlowNodes(ns), edges: fromFlowEdges(es) });
        if (isMounted.current) setSaveStatus('saved');
      } catch { if (isMounted.current) setSaveStatus('idle'); }
    }, 1200);
  }, [mapId]);

  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
        void api.updateModeMap(mapId, {
          nodes: fromFlowNodes(nodesRef.current),
          edges: fromFlowEdges(edgesRef.current),
        }).catch(() => reportClientError({ message: 'mode map unmount save failed', section: 'modeMap' }));
      }
    };
  }, [mapId, nodesRef, edgesRef]);

  return { saveStatus, scheduleSave };
}
