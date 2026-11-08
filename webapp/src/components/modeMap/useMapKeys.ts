import { useEffect } from 'react';
import type { useNodesState, useEdgesState } from '@xyflow/react';
import type { FlowNode, FlowEdge } from '../modeMapFlow';

interface Args {
  nodes: FlowNode[]; edges: FlowEdge[];
  selectedNodeId: string | null; selectedEdgeId: string | null;
  setNodes: ReturnType<typeof useNodesState<FlowNode>>[1];
  setEdges: ReturnType<typeof useEdgesState<FlowEdge>>[1];
  setSelectedNodeId: (id: string | null) => void;
  setSelectedEdgeId: (id: string | null) => void;
  scheduleSave: (ns: FlowNode[], es: FlowEdge[]) => void;
  pushHistory: () => void; undo: () => void; redo: () => void;
}

/** Все фигуры карты — выделенными: ⌘A, «Выделить всё» в «⋯ Ещё» и в меню холста. */
export const selectAllNodes = (ns: FlowNode[]): FlowNode[] => ns.map(n => ({ ...n, selected: true }));

// Горячие клавиши редактора карты. Вынесено из ModeMapEditor.tsx (правило №10).
// В полях ввода не срабатывают (⌘Z, ⌘A и Backspace там правят текст), под
// открытым диалогом — тоже: клавиша не должна трогать карту за ним.
export function useMapKeys({ nodes, edges, selectedNodeId, selectedEdgeId, setNodes, setEdges,
  setSelectedNodeId, setSelectedEdgeId, scheduleSave, pushHistory, undo, redo }: Args) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (target?.closest?.('[role="dialog"]')) return;
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      // Undo / Redo
      if (mod && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
        return;
      }
      if (mod && key === 'y') { e.preventDefault(); redo(); return; }
      // Select all nodes (Cmd/Ctrl+A)
      if (mod && key === 'a') { e.preventDefault(); setNodes(selectAllNodes); return; }
      // Duplicate selected node (Cmd/Ctrl+D)
      if (mod && key === 'd') {
        e.preventDefault();
        const sel = nodes.filter(n => n.selected).map(n => n.id);
        const ids = sel.length ? sel : (selectedNodeId ? [selectedNodeId] : []);
        if (ids.length) {
          pushHistory();
          const copies = ids.map(id => {
            const src = nodes.find(n => n.id === id); if (!src) return null;
            return { ...src, id: `${src.type}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              position: { x: src.position.x + 40, y: src.position.y + 40 }, selected: false, data: { ...src.data } };
          }).filter(Boolean) as typeof nodes;
          const newNodes = [...nodes, ...copies];
          setNodes(newNodes); scheduleSave(newNodes, edges);
        }
        return;
      }
      if (e.key === 'Escape') { setSelectedNodeId(null); setSelectedEdgeId(null); return; }
      if (e.key === 'Backspace' || e.key === 'Delete') {
        // Multi-select (Shift+box) → delete all selected; else single selection
        const selNodes = nodes.filter(n => n.selected).map(n => n.id);
        const selEdges = edges.filter(e2 => e2.selected).map(e2 => e2.id);
        if (selNodes.length || selEdges.length) {
          pushHistory();
          const delN = new Set(selNodes);
          const newNodes = nodes.filter(n => !delN.has(n.id));
          const newEdges = edges.filter(e2 => !selEdges.includes(e2.id) && !delN.has(e2.source) && !delN.has(e2.target));
          setNodes(newNodes); setEdges(newEdges); setSelectedNodeId(null); setSelectedEdgeId(null);
          scheduleSave(newNodes, newEdges);
        } else if (selectedNodeId) {
          pushHistory();
          const newNodes = nodes.filter(n => n.id !== selectedNodeId);
          const newEdges = edges.filter(e2 => e2.source !== selectedNodeId && e2.target !== selectedNodeId);
          setNodes(newNodes); setEdges(newEdges); setSelectedNodeId(null);
          scheduleSave(newNodes, newEdges);
        } else if (selectedEdgeId) {
          pushHistory();
          const newEdges = edges.filter(e2 => e2.id !== selectedEdgeId);
          setEdges(newEdges); setSelectedEdgeId(null);
          scheduleSave(nodes, newEdges);
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedNodeId, selectedEdgeId, nodes, edges, setNodes, setEdges, setSelectedNodeId, setSelectedEdgeId,
    scheduleSave, pushHistory, undo, redo]);
}
