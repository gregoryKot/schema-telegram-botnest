import type { Node } from '@xyflow/react';

type FlowNode = Node<Record<string, unknown>>;

// «Осадка» перенесённой схемы случая. Раскладка диаграммы режет текст по числу
// строк, а на холсте он виден целиком: длинное убеждение даёт фигуру выше, чем ей
// отвели, и соседняя фигура колонки оказывается под ней. Когда фигуры измерены,
// колонки раздвигаются вниз по реальной высоте; ничего другого осадка не трогает.

/** Круг и таблетки в нём: геометрия фиксирована (диаметр круга, раскладка по кругу). */
const FIXED_TYPES = new Set(['need', 'needs']);

export const isFlaggedForSettle = (n: FlowNode) =>
  (n.data as { settle?: boolean } | undefined)?.settle === true;

const hasSize = (n: FlowNode) => n.measured?.width != null && n.measured?.height != null;

/** Фигуры, чьи отрезки по x пересекаются, — одна колонка (слева направо, без разрывов). */
function columnsOf(list: FlowNode[]): FlowNode[][] {
  const columns: FlowNode[][] = [];
  let right = -Infinity;
  for (const n of [...list].sort((a, b) => a.position.x - b.position.x)) {
    const edge = n.position.x + n.measured!.width!;
    if (columns.length > 0 && n.position.x < right) {
      columns[columns.length - 1].push(n);
      right = Math.max(right, edge);
    } else {
      columns.push([n]);
      right = edge;
    }
  }
  return columns;
}

/**
 * Раздвигает колонки новых фигур по измеренной высоте и снимает флаг `data.settle`
 * со всех. Двигаются только фигуры с флагом и размером, кроме `need`/`needs`;
 * каждая, наползающая на предыдущую в своей колонке, едет вниз так, чтобы между
 * ними остался `gap`. Порядок и `x` сохраняются. `changed` — хоть что-то
 * отличается от входа (сдвиг или снятый флаг); без флагов — false.
 */
export function settleColumns(nodes: FlowNode[], gap = 24): { nodes: FlowNode[]; changed: boolean } {
  const movable = nodes.filter((n) => isFlaggedForSettle(n) && hasSize(n) && !FIXED_TYPES.has(n.type ?? ''));
  const newY = new Map<string, number>();
  for (const column of columnsOf(movable)) {
    let bottom = -Infinity;
    for (const n of [...column].sort((a, b) => a.position.y - b.position.y)) {
      const y = Math.max(n.position.y, bottom + gap);
      newY.set(n.id, y);
      bottom = y + n.measured!.height!;
    }
  }

  let changed = false;
  const out = nodes.map((n) => {
    if (!isFlaggedForSettle(n)) return n;
    changed = true;
    const { settle: _settle, ...data } = n.data;
    return { ...n, position: { x: n.position.x, y: newY.get(n.id) ?? n.position.y }, data };
  });
  return { nodes: out, changed };
}
