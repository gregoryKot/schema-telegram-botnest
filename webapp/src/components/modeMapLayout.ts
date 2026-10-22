import type { Node } from '@xyflow/react';
import type { ModeMapNode } from '../api';
import { NODE_DEFAULT_SIZES } from './modeMapData';

type FlowNode = Node<Record<string, unknown>>;

export { autoLayout } from './modeMap/autoLayout';
export { layoutByZones } from './modeMap/zonesLayout';

// ── Couple "cycle clash" layout — Partner A column left, Partner B column right ─
const ROLE_RANK: Record<string, number> = { trigger: 0, critic: 1, child: 2, coping: 3, behavior: 4, healthy: 5, custom: 3 };

export function layoutCouple(nodes: FlowNode[]): FlowNode[] {
  const cols: Record<'A' | 'B' | 'C', FlowNode[]> = { A: [], B: [], C: [] };
  nodes.forEach(n => {
    const side = (n.data as { side?: 'A' | 'B' } | undefined)?.side;
    cols[side === 'A' ? 'A' : side === 'B' ? 'B' : 'C'].push(n);
  });
  const COL_X: Record<string, number> = { A: -360, C: -110, B: 160 };
  const ROW_H = 160;
  const out: FlowNode[] = [];
  (['A', 'C', 'B'] as const).forEach(key => {
    cols[key].slice()
      .sort((a, b) => (ROLE_RANK[a.type ?? 'custom'] ?? 3) - (ROLE_RANK[b.type ?? 'custom'] ?? 3))
      .forEach((n, i) => out.push({ ...n, position: { x: COL_X[key], y: i * ROW_H } }));
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

let templateInsertSeq = 0; // Date.now() (1мс) совпадает при двух вставках подряд → id сталкивались бы.
export function templateToGraph(tpl: Template) {
  const stamp = `${Date.now()}_${templateInsertSeq++}`;
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
