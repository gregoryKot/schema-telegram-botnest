// Общий сетап для тестов ModeMapFloatingEdge.tsx — линия между узлами карты
// режимов реально рендерится в @xyflow/react только когда границы узла
// измерены реальным ResizeObserver'ом (которого в jsdom нет), поэтому
// напрямую через <ReactFlow nodes={...} edges={...}> путь недостижим (см.
// комментарий вверху ModeMapFloatingEdge.test.tsx). Вместо этого мокаем
// `useInternalNode` — единственное место, откуда FloatingEdge берёт реальную
// геометрию узлов, — и рендерим компонент внутри настоящего <ReactFlow>
// (пустого, без своих узлов), чтобы EdgeLabelRenderer/реконнект-точки нашли
// портал-контейнер и реально смонтировались.
import { vi } from 'vitest';
import type { ComponentProps } from 'react';
import { render } from '@testing-library/react';
import { Position, ReactFlow, ReactFlowProvider } from '@xyflow/react';
import type { InternalNode, Node } from '@xyflow/react';

export const useInternalNodeMock = vi.fn();
// getIntersectingNodes/screenToFlowPosition реального инстанса в jsdom всегда
// пустые (см. комментарий в .test.tsx) — подменяем только их, остальной
// useReactFlow (zoomIn/fitView и т.д.) реальным компонентам не нужен здесь.
export const getIntersectingNodesMock = vi.fn(() => [] as { id: string }[]);
const screenToFlowPositionMock = vi.fn((p: { x: number; y: number }) => p);
vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xyflow/react')>();
  return {
    ...actual,
    useInternalNode: (id: string) => useInternalNodeMock(id),
    useReactFlow: () => ({
      screenToFlowPosition: screenToFlowPositionMock,
      getIntersectingNodes: getIntersectingNodesMock,
    }),
  };
});

import { FloatingEdge } from './ModeMapFloatingEdge';

/** Строит InternalNode с абсолютной позицией/размером — как их видит FloatingEdge. */
export function internalNode(
  id: string,
  type: string,
  x: number,
  y: number,
  opts: { w?: number; h?: number; data?: Record<string, unknown> } = {},
): InternalNode<Node> {
  const { w = 100, h = 50, data = {} } = opts;
  return {
    id,
    type,
    position: { x, y },
    data,
    measured: { width: w, height: h },
    internals: {
      positionAbsolute: { x, y },
      z: 0,
      userNode: {} as Node,
      handleBounds: undefined,
    },
  } as unknown as InternalNode<Node>;
}

/** Регистрирует, что useInternalNode('a')/('b') вернут для теста (undefined = «узел не найден»). */
export function stubNodes(map: Record<string, InternalNode<Node> | undefined>) {
  useInternalNodeMock.mockImplementation((id: string) => map[id]);
}

type Props = ComponentProps<typeof FloatingEdge>;

export function renderFloatingEdge(overrides: Partial<Props> = {}) {
  const props: Props = {
    id: 'e1',
    source: 'a',
    target: 'b',
    selected: false,
    markerEnd: undefined,
    markerStart: undefined,
    style: {},
    label: undefined,
    labelStyle: undefined,
    sourceX: 0,
    sourceY: 0,
    targetX: 0,
    targetY: 0,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    ...overrides,
  };
  return render(
    <ReactFlowProvider>
      <ReactFlow nodes={[]} edges={[]} />
      <svg>
        <FloatingEdge {...props} />
      </svg>
    </ReactFlowProvider>,
  );
}
