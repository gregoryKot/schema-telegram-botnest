// Линии к таблеткам потребностей. Таблетки стоят внутри круга 2–1–2, поэтому
// «в лоб» дотянуться можно не до каждой: дальняя таблетка ряда закрыта ближней.
// Широкий вид: к таблеткам со стороны схем (или Здорового Взрослого) линия идёт
// сбоку, а к дальней колонке — по просвету между рядами таблеток; «чистая»
// линия не задевает чужих фигур, иначе — по каналу. Узкий вид: линия входит в
// таблетку с её внешнего бока и идёт по дорожке (diagramLanes.ts).
import { isClear, smoothSide, type Rect } from './diagramCurves';
import { NEED_SLOT } from './diagramCircle';
import type { Side } from './diagramPorts';
import { rounded } from './diagramPolyline';
import type { DiagramCircle, DiagramNode, Pt } from './diagramTypes';

export type NeedKind = 'blocks' | 'meets';

export interface NeedCtx {
  circle: DiagramCircle;
  /** Высоты зазоров между рядами таблеток. */
  bands: [number, number];
  wide: boolean;
}

const CORNER = 12;
const CHANNEL_STEP = 6;
/** Расстояние между линиями, идущими по одному просвету между рядами таблеток. */
const BAND_STEP = 4;

/** Со стороны схем (блок) или Здорового Взрослого (опора) линия идёт к кругу. */
const fromLeft = (kind: NeedKind, wide: boolean) => wide && kind === 'blocks';

/** С какой стороны линия входит в таблетку. */
export function needSide(
  kind: NeedKind,
  ctx: NeedCtx,
  pill: DiagramNode,
): Side {
  const { row, col } = NEED_SLOT[pill.needId ?? ''] ?? { row: 1, col: 'C' };
  if (!ctx.wide) {
    if (col === 'L') return 'left';
    if (col === 'R') return 'right';
    return kind === 'blocks' ? 'left' : 'right';
  }
  const near = fromLeft(kind, true) ? 'L' : 'R';
  if (col === 'C' || col === near) return near === 'L' ? 'left' : 'right';
  return row === 0 ? 'bottom' : 'top';
}

/** Просвет между рядами, по которому линия входит в таблетку; null — вход сбоку. */
export function bandOf(side: Side): 0 | 1 | null {
  return side === 'bottom' ? 0 : side === 'top' ? 1 : null;
}

/** x вертикального канала между фигурами-источниками и кругом (широкий вид). */
function channelX(kind: NeedKind, s: Pt, c: DiagramCircle, lane: number) {
  const step = CHANNEL_STEP * (lane % 5);
  return fromLeft(kind, true)
    ? Math.min(s.x + 16 + step, c.cx - c.r - 10)
    : Math.max(s.x - 16 - step, c.cx + c.r + 10);
}

/** Линия от порта источника s до порта таблетки t, вошедшая со стороны side (широкий вид). */
export function routeNeed(
  kind: NeedKind,
  s: Pt,
  t: Pt,
  side: Side,
  ctx: NeedCtx,
  lane: number,
  slot: { k: number; n: number },
  obstacles: Rect[],
): Pt[] {
  const x = channelX(kind, s, ctx.circle, lane);
  const b = bandOf(side);
  if (b !== null) {
    const band = ctx.bands[b] + (slot.k - (slot.n - 1) / 2) * BAND_STEP;
    return rounded(
      [s, { x, y: s.y }, { x, y: band }, { x: t.x, y: band }, t],
      CORNER,
    );
  }
  const direct = smoothSide(s, t);
  if (isClear(direct, obstacles)) return direct;
  return rounded([s, { x, y: s.y }, { x, y: t.y }, t], CORNER);
}
