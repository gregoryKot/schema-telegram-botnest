// Круг базовых потребностей: якорь схемы случая, рисуется всегда. Внутри пять
// таблеток 2–1–2 (привязанность и автономия, выражение чувств посередине, игра
// и границы). Таблетка — кнопка фокуса; к ней идут ✗ от схем и ✓ от
// Здорового Взрослого.
import { needColor } from '../../../needs/needColors';
import { NEED_ORDER, getNeedData } from '../../../needs/needData';
import { LINE } from './diagramMeasure';
import type { DiagramCircle, DiagramNode, Pt } from './diagramTypes';

export const NEEDS_TITLE = 'Базовые эмоциональные потребности';
export const PILL_H = 36;
const ROW_GAP = 22;
const TITLE_GAP = 12;

/** Ряд (сверху вниз) и колонка таблетки внутри круга; порядок — NEED_ORDER. */
export const NEED_SLOT: Record<
  string,
  { row: 0 | 1 | 2; col: 'L' | 'C' | 'R' }
> = {
  attachment: { row: 0, col: 'L' },
  autonomy: { row: 0, col: 'R' },
  expression: { row: 1, col: 'C' },
  play: { row: 2, col: 'L' },
  limits: { row: 2, col: 'R' },
};

/** Расстояние между колонками таблеток: сюда проходит линия к средней. */
export const COL_GAP = 20;

export interface CircleGeometry {
  circle: DiagramCircle;
  needs: DiagramNode[];
  /** Высоты зазоров между рядами таблеток: по ним идут линии к дальним таблеткам. */
  bands: [number, number];
  /** Где заканчивается подпись круга. */
  titleY: number;
}

export function circleGeometry(d: number, center: Pt): CircleGeometry {
  const pw = Math.round(0.33 * d);
  const cw = Math.min(170, Math.max(pw + 24, Math.round(0.5 * d)));
  const block = 3 * PILL_H + 2 * ROW_GAP;
  const total = LINE.title + TITLE_GAP + block;
  const top = center.y - total / 2;
  const rowTop = (row: number) =>
    top + LINE.title + TITLE_GAP + row * (PILL_H + ROW_GAP);
  const data = getNeedData('ty');
  const needs = NEED_ORDER.map((id): DiagramNode => {
    const { row, col } = NEED_SLOT[id];
    const w = col === 'C' ? cw : pw;
    const x =
      col === 'C'
        ? center.x - cw / 2
        : col === 'L'
          ? center.x - COL_GAP / 2 - pw
          : center.x + COL_GAP / 2;
    return {
      id: `need:${id}`,
      kind: 'need',
      shape: 'pill',
      section: 'needs',
      x,
      y: rowTop(row),
      w,
      h: PILL_H,
      label: data[id].name,
      color: needColor(id),
      needId: id,
    };
  });
  return {
    circle: { cx: center.x, cy: center.y, r: d / 2, title: NEEDS_TITLE },
    needs,
    bands: [rowTop(1) - ROW_GAP / 2, rowTop(2) - ROW_GAP / 2],
    titleY: top + LINE.title / 2,
  };
}
