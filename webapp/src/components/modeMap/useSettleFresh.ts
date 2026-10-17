import { useEffect, type MutableRefObject } from 'react';
import type { FlowEdge, FlowNode } from '../modeMapFlow';
import { isFlaggedForSettle, settleColumns } from './settleColumns';

interface Params {
  nodes: FlowNode[];
  edgesRef: MutableRefObject<FlowEdge[]>;
  setNodes: (nodes: FlowNode[]) => void;
  scheduleSave: (nodes: FlowNode[], edges: FlowEdge[]) => void;
}

/**
 * Осадка свежей схемы случая: фигуры, пришедшие с флагом `data.settle` (кнопка
 * «Открыть на холсте» или пункт «Из концептуализации клиента»), ждут первого
 * замера — пока измерена не каждая, ничего не происходит. Потом колонки один раз
 * раздвигаются по реальной высоте, флаг снимается, карта сохраняется (флаг уходит
 * из сохранённой карты, повторной осадки не будет). В историю undo это не
 * попадает: осадка продолжает вставку, а не действие терапевта.
 */
export function useSettleFresh({ nodes, edgesRef, setNodes, scheduleSave }: Params) {
  useEffect(() => {
    const flagged = nodes.filter(isFlaggedForSettle);
    if (flagged.length === 0 || flagged.some((n) => !n.measured?.width || !n.measured.height)) return;
    const settled = settleColumns(nodes);
    if (!settled.changed) return;
    setNodes(settled.nodes);
    scheduleSave(settled.nodes, edgesRef.current);
  }, [nodes, edgesRef, setNodes, scheduleSave]);
}
