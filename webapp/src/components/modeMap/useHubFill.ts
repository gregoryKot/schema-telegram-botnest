import { useCallback } from 'react';
import type { useNodesState } from '@xyflow/react';
import { toFlowNodes, type FlowEdge, type FlowNode } from '../modeMapFlow';
import { NEED_ORDER } from '../../../../shared/src/needs/needData';
import { hubNeedNodes, missingHubNeeds } from './hubFill';
import type { HubFill } from './NodeMeaningFields';

interface Params {
  nodes: FlowNode[];
  edges: FlowEdge[];
  setNodes: ReturnType<typeof useNodesState<FlowNode>>[1];
  scheduleSave: (ns: FlowNode[], es: FlowEdge[]) => void;
  pushHistory: () => void;
}

/**
 * Кнопка панели круга потребностей: сколько из пяти потребностей не стоит внутри
 * круга и как их поставить на свои места 2–1–2. Нужна кругам, поставленным до
 * того, как палитра стала приносить их заполненными, и после удаления таблетки.
 * Одно действие — один шаг истории, как у любой правки холста.
 */
export function useHubFill({ nodes, edges, setNodes, scheduleSave, pushHistory }: Params) {
  return useCallback((hub: FlowNode): HubFill => {
    const missing = missingHubNeeds(hub, nodes);
    const fill = () => {
      if (missing.length === 0) return;
      const have = new Set(NEED_ORDER.filter((id) => !missing.includes(id)));
      const diameter = (hub.data as { diameter?: number }).diameter;
      pushHistory();
      const newNodes = [...nodes, ...toFlowNodes(hubNeedNodes(hub.id, hub.position, diameter, have))];
      setNodes(newNodes); scheduleSave(newNodes, edges);
    };
    return { missing: missing.length, fill };
  }, [nodes, edges, setNodes, scheduleSave, pushHistory]);
}
