import { useCallback, useRef, type MutableRefObject } from 'react';
import type { OnNodeDrag, useNodesState } from '@xyflow/react';
import type { FlowNode } from '../modeMapFlow';
import { nodesInsideHub } from './hubGeometry';

type Point = { x: number; y: number };

/**
 * Круг потребностей тащит свои потребности: пока двигается круг, вместе с ним
 * едут все ноды, чей центр лежал внутри него в момент начала перетаскивания.
 * Позиции считаются от стартовых (старт + сдвиг круга), поэтому погрешность не
 * копится от кадра к кадру. Сохранение после драга общее: холст сохраняет по
 * окончании перетаскивания круга, а его потребности к тому времени уже на месте.
 */
export function useHubDrag({ nodesRef, setNodes }: {
  nodesRef: MutableRefObject<FlowNode[]>;
  setNodes: ReturnType<typeof useNodesState<FlowNode>>[1];
}) {
  const drag = useRef<{ hubId: string; hubStart: Point; startOf: Map<string, Point> } | null>(null);

  const onNodeDragStart = useCallback<OnNodeDrag<FlowNode>>((_e, node, dragged) => {
    if (node.type !== 'needs') { drag.current = null; return; }
    // Ноды, которые xyflow и так тащит (выделены вместе с кругом), не двигаем второй раз.
    const alsoDragged = new Set(dragged.map((n) => n.id));
    const inside = nodesInsideHub(node, nodesRef.current).filter((n) => !alsoDragged.has(n.id));
    drag.current = {
      hubId: node.id,
      hubStart: { ...node.position },
      startOf: new Map(inside.map((n) => [n.id, { ...n.position }])),
    };
  }, [nodesRef]);

  const onNodeDrag = useCallback<OnNodeDrag<FlowNode>>((_e, node) => {
    const d = drag.current;
    if (!d || node.id !== d.hubId) return;
    const dx = node.position.x - d.hubStart.x;
    const dy = node.position.y - d.hubStart.y;
    setNodes((ns) => ns.map((n) => {
      const from = d.startOf.get(n.id);
      return from ? { ...n, position: { x: from.x + dx, y: from.y + dy } } : n;
    }));
  }, [setNodes]);

  return { onNodeDragStart, onNodeDrag };
}
