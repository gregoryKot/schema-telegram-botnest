import { useCallback, useMemo } from 'react';
import { useReactFlow, useStoreApi, type FitViewOptions, type Node } from '@xyflow/react';
import { findFreeSpots, fitInsets, insideView, NEW_NODE_SIZE, type Rect } from './canvasSpace';

type Pos = { x: number; y: number };

const nodeRect = (n: Node): Rect => ({
  x: n.position.x, y: n.position.y,
  w: n.measured?.width ?? n.width ?? NEW_NODE_SIZE.w,
  h: n.measured?.height ?? n.height ?? NEW_NODE_SIZE.h,
});

/**
 * Место на холсте в момент вызова (QA 2026-10-26: фигуры из палитры ложились
 * случайно друг на друга, а «Показать всё» прятало их под панелью подсказок).
 * `place` — позиции новых фигур в видимой области без наложения на фигуры и
 * панели; `fit` / `fitOptions` — «Показать всё» с отступами под панели и без
 * увеличения сверх 100%. Нужен ReactFlowProvider выше по дереву.
 */
export function useCanvasSpace() {
  const store = useStoreApi();
  const { fitView } = useReactFlow();

  const measure = useCallback(() => {
    const { domNode, transform: [tx, ty, zoom] } = store.getState();
    const pane = domNode?.getBoundingClientRect();
    if (!domNode || !pane || pane.width === 0 || pane.height === 0) return null;
    const screen: Rect[] = [...domNode.querySelectorAll('.react-flow__panel')].map(el => {
      const r = el.getBoundingClientRect();
      return { x: r.left - pane.left, y: r.top - pane.top, w: r.width, h: r.height };
    });
    const toFlow = (r: Rect): Rect => ({ x: (r.x - tx) / zoom, y: (r.y - ty) / zoom, w: r.w / zoom, h: r.h / zoom });
    return { pane: { w: pane.width, h: pane.height }, screen, view: toFlow({ x: 0, y: 0, w: pane.width, h: pane.height }), panels: screen.map(toFlow) };
  }, [store]);

  const fitOptions = useCallback((): FitViewOptions => {
    const m = measure();
    if (!m) return { maxZoom: 1 }; // холст не измерен — отступ по умолчанию React Flow
    const ins = fitInsets(m.pane, m.screen);
    return { padding: { top: `${ins.top}px`, right: `${ins.right}px`, bottom: `${ins.bottom}px`, left: `${ins.left}px` }, maxZoom: 1 };
  }, [measure]);

  const fit = useCallback((duration = 300) => { void fitView({ ...fitOptions(), duration }); }, [fitView, fitOptions]);

  const place = useCallback((nodes: Node[], count = 1): Pos[] => {
    const m = measure();
    if (!m) {
      // Холст ещё не измерен (скрытая вкладка, тест): лесенкой от последней фигуры.
      const last = nodes[nodes.length - 1]?.position ?? { x: 160, y: 80 };
      return Array.from({ length: count }, (_, i) => ({ x: last.x + 40 * (i + 1), y: last.y + 40 * (i + 1) }));
    }
    const spots = findFreeSpots(m.view, [...nodes.map(nodeRect), ...m.panels], count);
    if (spots.some(p => !insideView(m.view, p))) setTimeout(() => fit(), 60);
    return spots;
  }, [measure, fit]);

  return useMemo(() => ({ place, fit, fitOptions }), [place, fit, fitOptions]);
}
