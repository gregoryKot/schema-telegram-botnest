// Фокус диаграммы: нажатая схема или потребность (или открытый режим) делает
// свои линии яркими, остальные гасит. Чистые функции — чтобы проверять без DOM.
import type { DiagramEdge, DiagramLayout, DiagramNode } from './diagramTypes';

export const DIM_EDGE = 0.12;
export const DIM_NODE = 0.35;

/** Линии «питает» привязаны к фигуре; стрелки между кластерами — нет. */
const touches = (e: DiagramEdge, id: string) =>
  (e.kind === 'feeds' || e.kind === 'need') && (e.from === id || e.to === id);

/** Фокус только на существующую фигуру: устаревший id не гасит всю схему. */
export function resolveFocus(
  layout: DiagramLayout,
  pressedId: string | null,
  openModeId: string | null,
): string | null {
  const id = pressedId ?? (openModeId ? `mode:${openModeId}` : null);
  return id && layout.nodes.some((n) => n.id === id) ? id : null;
}

export function edgeOpacity(e: DiagramEdge, focus: string | null): number {
  if (!focus) return e.opacity;
  return touches(e, focus) ? 1 : DIM_EDGE;
}

export function nodeOpacity(
  n: DiagramNode,
  focus: string | null,
  edges: DiagramEdge[],
): number {
  if (!focus || n.id === focus) return 1;
  const linked = edges.some(
    (e) => touches(e, focus) && (e.from === n.id || e.to === n.id),
  );
  return linked ? 1 : DIM_NODE;
}
