import { useCallback, useState } from 'react';
import type { FlowNode, FlowEdge } from './modeMapFlow';

type Snapshot = { nodes: FlowNode[]; edges: FlowEdge[] };
const LIMIT = 60; // глубина истории; самые старые снапшоты вытесняются с начала стека

interface Params {
  nodesRef: React.MutableRefObject<FlowNode[]>;
  edgesRef: React.MutableRefObject<FlowEdge[]>;
  setNodes: (ns: FlowNode[]) => void;
  setEdges: (es: FlowEdge[]) => void;
  scheduleSave: (ns: FlowNode[], es: FlowEdge[]) => void;
  clearSelection: () => void;
}

export function useModeMapHistory({ nodesRef, edgesRef, setNodes, setEdges, scheduleSave, clearSelection }: Params) {
  // Стеки живут в state, а не в ref: canUndo/canRedo выводятся из них без чтения ref в рендере.
  const [past, setPast] = useState<Snapshot[]>([]);
  const [future, setFuture] = useState<Snapshot[]>([]);
  // Снимок холста; рефы читаются только внутри колбэков — уже после коммита.
  const snapshot = useCallback((): Snapshot => ({ nodes: nodesRef.current, edges: edgesRef.current }), [nodesRef, edgesRef]);

  const pushHistory = useCallback(() => {
    setPast(p => [...p, snapshot()].slice(-LIMIT));
    setFuture([]);
  }, [snapshot]);

  const undo = useCallback(() => {
    const prev = past[past.length - 1];
    if (!prev) return;
    const current = snapshot();
    setPast(p => p.slice(0, -1));
    setFuture(f => [...f, current]);
    setNodes(prev.nodes); setEdges(prev.edges);
    clearSelection(); scheduleSave(prev.nodes, prev.edges);
  }, [past, snapshot, setNodes, setEdges, scheduleSave, clearSelection]);

  const redo = useCallback(() => {
    const next = future[future.length - 1];
    if (!next) return;
    const current = snapshot();
    setFuture(f => f.slice(0, -1));
    setPast(p => [...p, current].slice(-LIMIT));
    setNodes(next.nodes); setEdges(next.edges);
    clearSelection(); scheduleSave(next.nodes, next.edges);
  }, [future, snapshot, setNodes, setEdges, scheduleSave, clearSelection]);

  return { pushHistory, undo, redo, canUndo: past.length > 0, canRedo: future.length > 0 };
}
