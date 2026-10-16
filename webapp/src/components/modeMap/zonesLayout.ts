import type { Node } from '@xyflow/react';
import { NODE_DEFAULT_SIZES } from '../modeMapData';
import { HUB_DIAMETER, nodesInsideHub } from './hubGeometry';

type FlowNode = Node<Record<string, unknown>>;

// ── Layout by zones (mirror ModeMapZones bands) ───────────────────────────────
// Режимы раскладываются по трём полосам; «корни» схемы случая (схемы, опыт,
// круг потребностей с тем, что внутри) едут одним блоком под нижнюю полосу.

/** Нижняя граница полосы «Детские и критикующие» — её же рисует ModeMapZones. */
export const ZONES_BOTTOM = 980;
/** Просвет между нижней полосой и блоком корней. */
const ROOTS_GAP = 80;

// Band index per node type, and vertical centre of each band (flow coords).
const BAND_OF: Record<string, 0 | 1 | 2> = {
  healthy: 0,
  coping: 1,
  child: 2, critic: 2, trigger: 2, behavior: 2, custom: 2,
};
const BAND_CENTER_Y = [-200, 230, 690];   // matches BANDS in ModeMapZones.tsx
const BAND_GAP = 60;

const ROOT_TYPES = new Set(['schema', 'origin', 'needs']);

/** Размер ноды: измеренный → заданный → по типу → 150×70; у круга — диаметр. */
function sizeOf(n: FlowNode): { w: number; h: number } {
  if (n.type === 'needs') {
    const d = (n.data as { diameter?: number } | undefined)?.diameter ?? HUB_DIAMETER;
    return { w: d, h: d };
  }
  const def = NODE_DEFAULT_SIZES[n.type ?? ''];
  return {
    w: n.measured?.width ?? (n.width as number | undefined) ?? def?.width ?? 150,
    h: n.measured?.height ?? (n.height as number | undefined) ?? def?.height ?? 70,
  };
}

/** Схемы, опыт, круги потребностей и всё, что лежит внутри кругов. */
function rootsOf(nodes: FlowNode[]): Set<string> {
  const ids = new Set<string>();
  for (const n of nodes) if (ROOT_TYPES.has(n.type ?? '')) ids.add(n.id);
  for (const hub of nodes.filter((n) => n.type === 'needs')) {
    for (const inner of nodesInsideHub(hub, nodes)) ids.add(inner.id);
  }
  return ids;
}

/** Блок корней целиком: взаимное расположение то же, центр по x = 0, верх под нижней полосой. */
function placeRoots(roots: FlowNode[]): FlowNode[] {
  if (roots.length === 0) return [];
  const boxes = roots.map((n) => ({ n, ...sizeOf(n) }));
  const left = Math.min(...boxes.map((b) => b.n.position.x));
  const right = Math.max(...boxes.map((b) => b.n.position.x + b.w));
  const top = Math.min(...boxes.map((b) => b.n.position.y));
  const dx = -(left + right) / 2;
  const dy = ZONES_BOTTOM + ROOTS_GAP - top;
  return roots.map((n) => ({ ...n, position: { x: n.position.x + dx, y: n.position.y + dy } }));
}

/**
 * Arrange nodes into the type-bands shown when «Зоны» is on — a horizontal row per band.
 * Корни схемы случая (если они есть на карте) ставятся блоком ниже полос.
 */
export function layoutByZones(nodes: FlowNode[]): FlowNode[] {
  const rootIds = rootsOf(nodes);
  const bands: FlowNode[][] = [[], [], []];
  nodes.filter((n) => !rootIds.has(n.id)).forEach(n => bands[BAND_OF[n.type ?? 'custom'] ?? 2].push(n));
  const out: FlowNode[] = [];
  bands.forEach((list, band) => {
    // total width to centre the row around x=0
    const sized = list.slice().sort((a, b) => a.position.x - b.position.x).map(n => ({
      n,
      w: (n.width as number) ?? NODE_DEFAULT_SIZES[n.type ?? '']?.width ?? 150,
      h: (n.height as number) ?? NODE_DEFAULT_SIZES[n.type ?? '']?.height ?? 70,
    }));
    const total = sized.reduce((s, x) => s + x.w, 0) + BAND_GAP * Math.max(0, sized.length - 1);
    let x = -total / 2;
    for (const { n, w, h } of sized) {
      out.push({ ...n, position: { x, y: BAND_CENTER_Y[band] - h / 2 } });
      x += w + BAND_GAP;
    }
  });
  return [...out, ...placeRoots(nodes.filter((n) => rootIds.has(n.id)))];
}
