// Узкий вид: линии между секциями идут по дорожкам вдоль левого и правого
// краёв (фигуры стоят одной колонкой посередине, см. diagramNarrow.ts).
// Линия выходит из фигуры вбок, спускается по своей дорожке и входит в другую
// фигуру тем же боком. Длинная линия получает внешнюю дорожку, короткая —
// внутреннюю: вложенные линии не пересекаются.
import { rounded } from './diagramPolyline';
import { LANE_ZONE } from './diagramNarrow';
import type { Pt } from './diagramTypes';

export type LaneSide = 'left' | 'right';

export interface LaneItem {
  s: Pt;
  t: Pt;
  side: LaneSide;
}

/** Просвет от колонки фигур до ближайшей дорожки. */
const NEAR = 8;
const MAX_STEP = 5;
const CORNER = 10;

/**
 * x дорожки каждой линии: по стороне и рангу длины. Дорожки идут вплотную к
 * колонке фигур (`col`), а не у края экрана: на широком контейнере линии не
 * растягиваются через пустое поле.
 */
export function laneXs(
  items: LaneItem[],
  col: { x: number; w: number },
): number[] {
  const out = new Array<number>(items.length);
  for (const side of ['left', 'right'] as const) {
    const idx = items
      .map((_, i) => i)
      .filter((i) => items[i].side === side)
      .sort(
        (a, b) =>
          Math.abs(items[b].t.y - items[b].s.y) -
          Math.abs(items[a].t.y - items[a].s.y),
      );
    const room = LANE_ZONE - NEAR - 4;
    const step =
      idx.length > 1 ? Math.min(MAX_STEP, room / (idx.length - 1)) : 0;
    idx.forEach((i, rank) => {
      // самая длинная линия — самая дальняя дорожка: вложенные не пересекаются
      const off = NEAR + step * (idx.length - 1 - rank);
      out[i] = side === 'left' ? col.x - off : col.x + col.w + off;
    });
  }
  return out;
}

/** Линия «скобкой»: от s вбок до дорожки, по ней до уровня t и вбок в t. */
export function laneRoute(s: Pt, t: Pt, x: number): Pt[] {
  return rounded([s, { x, y: s.y }, { x, y: t.y }, t], CORNER);
}
