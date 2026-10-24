// Широкая раскладка (контейнер от WIDE_MIN): четыре колонки слева направо —
// режимы, схемы, круг потребностей, здоровые режимы. Колонки сжимаются от
// базовой ширины к минимальной вместе с контейнером, а лишнее место делится
// по краям. Все колонки центрируются по вертикали относительно круга.
import type { ConceptGraphModel } from '../conceptGraphTypes';
import {
  healthyNodes,
  modeNodes,
  ORIGIN_W,
  placeGroup,
  stack,
  schemaGroups,
  schemaPlaceholder,
} from './diagramColumns';
import { circleGeometry } from './diagramCircle';
import { orderColumns } from './diagramOrder';
import { HEAD_H, section } from './diagramSections';
import type { CircleGeometry } from './diagramCircle';
import type { DiagramNode, DiagramSection } from './diagramTypes';

const PAD = 12;
/** Колонки: режимы, схемы, круг, здоровые — базовая и минимальная ширина. */
const BASE = [230, 250, 340, 240] as const;
const MIN = [164, 180, 288, 170] as const;
/** Просветы между колонками: режимы–схемы, схемы–круг, круг–здоровые. */
const GAP_BASE = [64, 72, 72] as const;
const GAP_MIN = [38, 48, 48] as const;
const ITEM_GAP = 12;
const GROUP_GAP = 24;
const BOTTOM = 12;

const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

/** Ширины колонок и просветов для контейнера width. */
export function wideWidths(width: number): {
  cols: number[];
  gaps: number[];
  left: number;
} {
  const avail = width - 2 * PAD;
  const baseTotal = sum(BASE) + sum(GAP_BASE);
  const minTotal = sum(MIN) + sum(GAP_MIN);
  const t = Math.min(
    1,
    Math.max(0, (avail - minTotal) / (baseTotal - minTotal)),
  );
  const lerp = (lo: number, hi: number) => Math.round(lo + (hi - lo) * t);
  const cols = BASE.map((b, i) => lerp(MIN[i], b));
  const gaps = GAP_BASE.map((b, i) => lerp(GAP_MIN[i], b));
  const used = sum(cols) + sum(gaps);
  return { cols, gaps, left: PAD + Math.max(0, (avail - used) / 2) };
}

export interface WideLayout {
  height: number;
  nodes: DiagramNode[];
  sections: DiagramSection[];
  geometry: CircleGeometry;
}

export function layoutWide(
  graph: ConceptGraphModel,
  width: number,
): WideLayout {
  const { cols, gaps, left } = wideWidths(width);
  const xs = [
    left,
    left + cols[0] + gaps[0],
    left + cols[0] + gaps[0] + cols[1] + gaps[1],
    left + cols[0] + gaps[0] + cols[1] + gaps[1] + cols[2] + gaps[2],
  ];
  const ordered = orderColumns(graph);

  const laneOf = new Map(ordered.modes.map((c) => [c.modeId, c.lane]));
  const modes = stack(modeNodes(ordered, cols[0]), (a, b) =>
    laneOf.get(a.modeId ?? '') === laneOf.get(b.modeId ?? '')
      ? ITEM_GAP
      : GROUP_GAP,
  );
  const groups = schemaGroups(
    ordered.schemas,
    cols[1],
    Math.round(cols[1] * ORIGIN_W),
  );
  const schemas = groups.length
    ? (() => {
        let y = 0;
        const out: DiagramNode[] = [];
        groups.forEach((g, i) => {
          if (i > 0) y += GROUP_GAP;
          out.push(...placeGroup(g, 0, y));
          y += g.h;
        });
        return { nodes: out, h: y };
      })()
    : { nodes: [schemaPlaceholder(cols[1])], h: 92 };
  const healthy = stack(healthyNodes(graph, cols[3]), () => ITEM_GAP + 4);

  const colH = Math.max(modes.h, schemas.h, healthy.h, cols[2]);
  const cy = HEAD_H + colH / 2;
  const place = (col: { nodes: DiagramNode[]; h: number }, x: number) =>
    col.nodes.map((n) => ({
      ...n,
      x: x + n.x,
      y: n.y + cy - col.h / 2,
    }));
  const geometry = circleGeometry(cols[2], { x: xs[2] + cols[2] / 2, y: cy });
  return {
    height: HEAD_H + colH + BOTTOM,
    nodes: [
      ...place(modes, xs[0]),
      ...place(schemas, xs[1]),
      ...geometry.needs,
      ...place(healthy, xs[3]),
    ],
    sections: [
      section('modes', xs[0], 0, cols[0]),
      section('schemas', xs[1], 0, cols[1]),
      section('healthy', xs[3], 0, cols[3]),
    ],
    geometry,
  };
}
