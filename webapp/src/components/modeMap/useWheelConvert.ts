import { useCallback } from 'react';
import type { useEdgesState, useNodesState } from '@xyflow/react';
import type { FlowEdge, FlowNode } from '../modeMapFlow';
import { convertToWheel } from './wheelConvert';

interface Params {
  nodes: FlowNode[];
  edges: FlowEdge[];
  setNodes: ReturnType<typeof useNodesState<FlowNode>>[1];
  setEdges: ReturnType<typeof useEdgesState<FlowEdge>>[1];
  scheduleSave: (ns: FlowNode[], es: FlowEdge[]) => void;
  pushHistory: () => void;
}

/** «Превратить в колесо» в панели старого круга: одно действие — один шаг истории (⌘Z вернёт круг с таблетками). */
export function useWheelConvert({ nodes, edges, setNodes, setEdges, scheduleSave, pushHistory }: Params) {
  return useCallback((hubId: string) => {
    const next = convertToWheel(hubId, nodes, edges);
    if (!next) return;
    pushHistory();
    setNodes(next.nodes); setEdges(next.edges);
    scheduleSave(next.nodes, next.edges);
  }, [nodes, edges, setNodes, setEdges, scheduleSave, pushHistory]);
}
