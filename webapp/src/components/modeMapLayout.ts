import Dagre from '@dagrejs/dagre';
import type { Node, Edge } from '@xyflow/react';
import type { ModeMapNode } from '../api';
import { NODE_DEFAULT_SIZES } from './ModeMapNodes';

type FlowNode = Node<Record<string, unknown>>;
type FlowEdge = Edge<Record<string, unknown>>;

// ── Auto-layout via dagre ─────────────────────────────────────────────────────
export function autoLayout(nodes: FlowNode[], edges: FlowEdge[]): FlowNode[] {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', nodesep: 70, ranksep: 110, marginx: 40, marginy: 40 });

  nodes.forEach(n => {
    const w = (n.width as number) ?? NODE_DEFAULT_SIZES[n.type ?? '']?.width ?? 150;
    const h = (n.height as number) ?? NODE_DEFAULT_SIZES[n.type ?? '']?.height ?? 70;
    g.setNode(n.id, { width: w, height: h });
  });
  edges.forEach(e => g.setEdge(e.source, e.target));

  Dagre.layout(g);

  return nodes.map(n => {
    const p = g.node(n.id);
    if (!p) return n;
    return { ...n, position: { x: p.x - p.width / 2, y: p.y - p.height / 2 } };
  });
}

// ── Layout by zones (mirror ModeMapZones bands) ───────────────────────────────
// Band index per node type, and vertical centre of each band (flow coords).
const BAND_OF: Record<string, 0 | 1 | 2> = {
  healthy: 0,
  coping: 1,
  child: 2, critic: 2, trigger: 2, behavior: 2, custom: 2,
};
const BAND_CENTER_Y = [-200, 230, 690];   // matches BANDS in ModeMapZones.tsx
const BAND_GAP = 60;

/** Arrange nodes into the type-bands shown when «Зоны» is on — a horizontal row per band. */
export function layoutByZones(nodes: FlowNode[]): FlowNode[] {
  const bands: FlowNode[][] = [[], [], []];
  nodes.forEach(n => bands[BAND_OF[n.type ?? 'custom'] ?? 2].push(n));
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
  return out;
}

// ── Starter templates ─────────────────────────────────────────────────────────
type TemplateNode = Omit<ModeMapNode, 'position'> & { x: number; y: number };
interface Template {
  id: string; name: string; nodes: TemplateNode[];
  edges: { from: number; to: number; type?: string; label?: string }[];
}

export const TEMPLATES: Template[] = [
  {
    id: 'basic_cycle',
    name: 'Базовый цикл',
    nodes: [
      { id: 't_trig',   type: 'trigger', x: 0,   y: 160, data: { label: 'Триггер' } },
      { id: 't_critic', type: 'critic',  x: 240, y: 0,   data: { label: 'Критик' } },
      { id: 't_child',  type: 'child',   x: 240, y: 320, data: { label: 'Уязвимый Ребёнок' } },
      { id: 't_cope',   type: 'coping',  x: 520, y: 160, data: { label: 'Копинг', copingSubtype: 'avoid' } },
      { id: 't_beh',    type: 'behavior', x: 800, y: 160, data: { label: 'Поведение' } },
    ],
    edges: [
      { from: 0, to: 1, label: 'активирует' },
      { from: 1, to: 2, type: 'suppresses', label: 'давит' },
      { from: 2, to: 3, label: 'запускает' },
      { from: 3, to: 4, type: 'leads_to', label: 'ведёт к' },
    ],
  },
  {
    id: 'critic_child_cope',
    name: 'Критик → Ребёнок → Копинг',
    nodes: [
      { id: 'c_critic', type: 'critic', x: 0,   y: 0,   data: { label: 'Требовательный Критик' } },
      { id: 'c_child',  type: 'child',  x: 0,   y: 220, data: { label: 'Уязвимый Ребёнок' } },
      { id: 'c_over',   type: 'coping', x: 300, y: 0,   data: { label: 'Гиперкомпенсация', copingSubtype: 'over' } },
      { id: 'c_avoid',  type: 'coping', x: 300, y: 220, data: { label: 'Избегание', copingSubtype: 'avoid' } },
      { id: 'c_healthy',type: 'healthy',x: 600, y: 110, data: { label: 'Здоровый Взрослый' } },
    ],
    edges: [
      { from: 0, to: 1, type: 'suppresses' },
      { from: 1, to: 2 }, { from: 1, to: 3 },
      { from: 4, to: 0, type: 'protects' }, { from: 4, to: 1, type: 'protects' },
    ],
  },
];

export function templateToGraph(tpl: Template) {
  const stamp = Date.now();
  const nodes: ModeMapNode[] = tpl.nodes.map((n, i) => {
    const size = NODE_DEFAULT_SIZES[n.type] ?? {};
    return { id: `${n.id}_${stamp}_${i}`, type: n.type, position: { x: n.x, y: n.y }, data: n.data, ...size };
  });
  const edges = tpl.edges.map((e, i) => ({
    id: `te_${stamp}_${i}`,
    source: nodes[e.from].id, target: nodes[e.to].id,
    label: e.label,
    data: { edgeType: e.type ?? 'activates' },
  }));
  return { nodes, edges };
}
