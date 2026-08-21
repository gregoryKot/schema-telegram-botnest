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
        // react-hooks/exhaustive-deps просит скопировать ref.current заранее —
        // здесь этот совет неверен по сути задачи: флашу нужны САМЫЕ СВЕЖИЕ
        // узлы и связи на момент ухода с экрана. Копия, снятая при монтировании
        // (или на любом рендере до последней правки), отправила бы на сервер
        // устаревшую карту — ровно ту потерю данных, ради которой флаш и
        // добавлен. Значение читается один раз, синхронно, в самой очистке.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        const nodes = fromFlowNodes(nodesRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
        const edges = fromFlowEdges(edgesRef.current);
        // Promise.resolve вокруг вызова — не перестраховка «на всякий случай»:
        // флаш срабатывает при КАЖДОМ размонтировании редактора, в том числе в
        // тестах, где api.updateModeMap подменён моком без промиса. Голый
        // `.catch` на undefined кидал бы TypeError прямо в очистке эффекта —
        // React логировал бы это как ошибку уже после завершения теста, и
        // vitest падал бы при всех зелёных тестах (плавающе, по таймингу).
        void Promise.resolve(api.updateModeMap(mapId, { nodes, edges })).catch(() =>
          reportClientError({ message: 'mode map unmount save failed', section: 'modeMap' }),
        );
      }
    };
  }, [mapId, nodesRef, edgesRef]);

  return { saveStatus, scheduleSave };
}
