import { useCallback, useEffect, useRef, useState } from 'react';
import { api, reportClientError } from '../api';
import { fromFlowNodes, fromFlowEdges } from './modeMapFlow';
import type { FlowNode, FlowEdge } from './modeMapFlow';
import type { SaveStatus } from '../../../shared/src/therapy/SaveStatusLine';

// Дебаунсит api.updateModeMap на 1200мс и следит за статусом сохранения.
//
// РЕГРЕССИЯ: раньше таймер не отменялся при размонтировании — уход с экрана
// раньше 1200мс либо терял правку, либо звал setState на пропавшем дереве
// (гонка, обнажённая vitest --coverage: «unhandled rejection после teardown»).
// Чинится флагом isMounted (setState после ухода — no-op) и cleanup-эффектом,
// который отменяет таймер и досылает несохранённое немедленно,
// fire-and-forget — setSaveStatus здесь звать уже некому. Отказ уходит в
// телеметрию, а не молча (правило про тихий catch, CLAUDE.md).
//
// Issue #879 (шаг A): провал сохранения раньше молча возвращал 'idle' — терапевт
// видел погасший индикатор и считал правку сохранённой. Теперь — 'error' с
// отчётом в телеметрию, `retry()` повторяет отправку с текущими nodesRef/edgesRef,
// а `savedAt` даёт строке статуса «✓ Сохранено в ЧЧ:ММ».
export function useModeMapAutosave(
  mapId: number,
  nodesRef: React.MutableRefObject<FlowNode[]>,
  edgesRef: React.MutableRefObject<FlowEdge[]>,
) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(true);

  const save = useCallback(async (ns: FlowNode[], es: FlowEdge[]) => {
    if (isMounted.current) setSaveStatus('saving');
    try {
      await api.updateModeMap(mapId, { nodes: fromFlowNodes(ns), edges: fromFlowEdges(es) });
      if (isMounted.current) { setSavedAt(new Date()); setSaveStatus('saved'); }
    } catch {
      reportClientError({ message: 'mode map save failed', section: 'modeMap' });
      if (isMounted.current) setSaveStatus('error');
    }
  }, [mapId]);

  const scheduleSave = useCallback((ns: FlowNode[], es: FlowEdge[]) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveStatus('pending');
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null; // сработал — больше не «взведён» для unmount-флаша
      void save(ns, es);
    }, 1200);
  }, [save]);

  // «Повторить» после ошибки: шлёт САМЫЕ свежие узлы и связи, а не аргументы
  // последнего scheduleSave — иначе правки после провала потерялись бы.
  const retry = useCallback(() => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    void save(nodesRef.current, edgesRef.current);
  }, [save, nodesRef, edgesRef]);

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

  return { saveStatus, savedAt, retry, scheduleSave };
}
