import { useCallback, useEffect, useRef, useState } from 'react';
import { api, reportClientError } from '../api';
import { fromFlowNodes, fromFlowEdges } from './modeMapFlow';
import type { FlowNode, FlowEdge } from './modeMapFlow';
import type { SaveStatus } from '../../../shared/src/therapy/SaveStatusLine';
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
//
// Issue #879 (шаг A): провал сохранения раньше молча возвращал 'idle' — терапевт видел погасший
// индикатор и считал правку сохранённой. Теперь — 'error' с отчётом в телеметрию, `retry()` повторяет
// отправку с текущими nodesRef/edgesRef, а `savedAt` даёт строке статуса «✓ Сохранено в ЧЧ:ММ».
export function useModeMapAutosave(
  mapId: number,
  nodesRef: React.MutableRefObject<FlowNode[]>,
  edgesRef: React.MutableRefObject<FlowEdge[]>,
) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [savedAt, setSavedAt] = useState<Date | null>(null);
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
      if (isMounted.current) { setSavedAt(new Date()); setSaveStatus('saved'); }
    } catch {
      reportClientError({ message: 'mode map save failed', section: 'modeMap' });
      if (isMounted.current) setSaveStatus('error');
    }
  }

  const saver = usePendingSave<number, Scheduled>({
    delayMs: 1200,
    send,
    onLeaveError: () => reportClientError({ message: 'mode map unmount save failed', section: 'modeMap' }),
  });

  const scheduleSave = useCallback((ns: FlowNode[], es: FlowEdge[]) => {
    setSaveStatus('pending');
    saver.schedule(mapId, { ns, es });
  }, [mapId, saver]);

  // «Повторить» после ошибки: шлёт САМЫЕ свежие узлы и связи, а не аргументы последнего scheduleSave — иначе правки
  // после провала потерялись бы. Взведённый таймер заменяется и отправляется сразу (один вызов api).
  // Событие — литералом, как в useClientDetail.retrySave (трипваер analytics-sync, src/security).
  const retry = useCallback(() => {
    api.trackEvent('concept_save_retry');
    saver.schedule(mapId, { ns: nodesRef.current, es: edgesRef.current });
    saver.flush();
  }, [mapId, saver, nodesRef, edgesRef]);

  return { saveStatus, savedAt, retry, scheduleSave };
}
