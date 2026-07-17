import { useCallback, useRef, useState } from 'react';
import type { FlowNode, FlowEdge } from './modeMapFlow';

type Snapshot = { nodes: FlowNode[]; edges: FlowEdge[] };

interface Params {
  nodesRef: React.MutableRefObject<FlowNode[]>;
  edgesRef: React.MutableRefObject<FlowEdge[]>;
  setNodes: (ns: FlowNode[]) => void;
  setEdges: (es: FlowEdge[]) => void;
  scheduleSave: (ns: FlowNode[], es: FlowEdge[]) => void;
  clearSelection: () => void;
}

export function useModeMapHistory({ nodesRef, edgesRef, setNodes, setEdges, scheduleSave, clearSelection }: Params) {
  const past = useRef<Snapshot[]>([]);
  const future = useRef<Snapshot[]>([]);
  const [ver, setVer] = useState(0);

  const pushHistory = useCallback(() => {
    past.current.push({ nodes: nodesRef.current, edges: edgesRef.current });
    if (past.current.length > 60) past.current.shift();
    future.current = [];
    setVer(v => v + 1);
  }, [nodesRef, edgesRef]);

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push({ nodes: nodesRef.current, edges: edgesRef.current });
    setNodes(prev.nodes); setEdges(prev.edges);
    clearSelection(); setVer(v => v + 1);
    scheduleSave(prev.nodes, prev.edges);
  }, [nodesRef, edgesRef, setNodes, setEdges, scheduleSave, clearSelection]);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push({ nodes: nodesRef.current, edges: edgesRef.current });
    setNodes(next.nodes); setEdges(next.edges);
    clearSelection(); setVer(v => v + 1);
    scheduleSave(next.nodes, next.edges);
  }, [nodesRef, edgesRef, setNodes, setEdges, scheduleSave, clearSelection]);

  // `ver` referenced so canUndo/canRedo refresh on change
  void ver;
  // eslint-disable-next-line react-hooks/refs -- чтение ref в рендере для canUndo/canRedo с ручным setVer — перевод истории на state отдельной задачей
  return { pushHistory, undo, redo, canUndo: past.current.length > 0, canRedo: future.current.length > 0 };
}
