// Общий сетап для тестов ModeMapCanvas.tsx — сам холст карты режимов не
// используется в одиночку (только через ModeMapEditor), но именно он несёт
// почти всю бизнес-логику холста (тулбар, контекстные меню, drop, реконнект
// рёбер), поэтому у него отдельный хелпер: настоящие useNodesState/
// useEdgesState/useModeMapHistory (как в проде), плюс debug-JSON снапшот
// текущей модели — тест проверяет РЕЗУЛЬТАТ (какие узлы/рёбра остались), а не
// что колбэк был вызван.
import { vi } from 'vitest';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { render } from '@testing-library/react';
import { ReactFlowProvider, useNodesState, useEdgesState } from '@xyflow/react';
import { ModeMapCanvas } from './ModeMapCanvas';
import { useModeMapHistory } from './useModeMapHistory';
import type { FlowNode, FlowEdge } from './modeMapFlow';
import type { ModeMapKind } from '../api';

export const getConceptualization = vi.fn();
vi.mock('../api', () => ({
  api: {
    getConceptualization: (...a: unknown[]) => getConceptualization(...a),
  },
}));

interface HarnessProps {
  initialNodes?: FlowNode[];
  initialEdges?: FlowEdge[];
  kind?: ModeMapKind;
}

function Harness({
  initialNodes = [],
  initialEdges = [],
  kind = 'problem',
}: HarnessProps) {
  const [nodes, setNodes, onNodesChange] =
    useNodesState<FlowNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] =
    useEdgesState<FlowEdge>(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  useEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
  });
  const clearSelection = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, []);
  const scheduleSave = useMemo(() => vi.fn(), []);
  const { pushHistory, undo, redo, canUndo, canRedo } = useModeMapHistory({
    nodesRef,
    edgesRef,
    setNodes,
    setEdges,
    scheduleSave,
    clearSelection,
  });
  return (
    <>
      {/* Снапшот модели для ассертов — id/type/label узлов и id/source/target рёбер */}
      <div data-testid="mm-debug-nodes">
        {JSON.stringify(
          nodes.map((n) => ({
            id: n.id,
            type: n.type,
            label: (n.data as { label?: string })?.label,
            data: n.data,
          })),
        )}
      </div>
      <div data-testid="mm-debug-edges">
        {JSON.stringify(
          edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
        )}
      </div>
      <div data-testid="mm-debug-selected">{selectedNodeId ?? ''}</div>
      <div data-testid="mm-debug-selected-edge">{selectedEdgeId ?? ''}</div>
      <ModeMapCanvas
        clientId={1}
        mapId={1}
        kind={kind}
        nodes={nodes}
        edges={edges}
        setNodes={setNodes}
        setEdges={setEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        setSelectedNodeId={setSelectedNodeId}
        setSelectedEdgeId={setSelectedEdgeId}
        selectedNodeId={selectedNodeId}
        saveStatus="idle"
        scheduleSave={scheduleSave}
        pushHistory={pushHistory}
        nodesRef={nodesRef}
        edgesRef={edgesRef}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
      />
    </>
  );
}

export function renderCanvas(props: HarnessProps = {}) {
  return render(
    <ReactFlowProvider>
      <Harness {...props} />
    </ReactFlowProvider>,
  );
}

export function mmNode(
  id: string,
  type: string,
  data: Record<string, unknown> = {},
  position = { x: 0, y: 0 },
): FlowNode {
  return { id, type, position, data: { label: id, ...data } };
}
export function mmEdge(
  id: string,
  source: string,
  target: string,
  data: Record<string, unknown> = {},
): FlowEdge {
  return { id, source, target, data };
}

/** Читает и парсит debug-снапшот узлов/рёбер из отрендеренного дерева. */
export function readModel(container: HTMLElement): {
  nodes: {
    id: string;
    type?: string;
    label?: string;
    data?: Record<string, unknown>;
  }[];
  edges: { id: string; source: string; target: string }[];
} {
  const nodesEl = container.querySelector('[data-testid="mm-debug-nodes"]');
  const edgesEl = container.querySelector('[data-testid="mm-debug-edges"]');
  return {
    nodes: JSON.parse(nodesEl?.textContent ?? '[]'),
    edges: JSON.parse(edgesEl?.textContent ?? '[]'),
  };
}
