import { describe, it, expect } from 'vitest';
import type { FlowEdge, FlowNode } from '../modeMapFlow';
import { convertToWheel } from './wheelConvert';
import { WHEEL_CENTER_Y, WHEEL_NODE_W } from './needWheel';

// Старый круг-рамка с таблетками → колесо (владелец 2026-11-10: «круг непонятно для чего»).
const measured = { width: 112, height: 36 };
const hub: FlowNode = { id: 'hub', type: 'needs', position: { x: 0, y: 0 }, data: { label: 'К', diameter: 340 } };
const pill = (id: string, needId: string, x: number, y: number, note?: string): FlowNode =>
  ({ id, type: 'need', position: { x, y }, data: { label: needId, needId, ...(note ? { note } : {}) }, measured });
const nodes: FlowNode[] = [
  hub,
  pill('p1', 'attachment', 60, 120, 'Ищет близости'),
  pill('p2', 'play', 60, 220),
  { id: 'inside', type: 'trigger', position: { x: 150, y: 150 }, data: { label: 'Т' }, measured },
  pill('far', 'limits', 1000, 1000),
  { id: 's', type: 'schema', position: { x: 600, y: 0 }, data: { label: 'С', schemaId: 'abandonment' } },
];
const edges: FlowEdge[] = [
  { id: 'e1', source: 's', target: 'p1', label: '✗' },
  { id: 'e2', source: 'p2', target: 's' },
  { id: 'e3', source: 's', target: 'far' },
];

describe('convertToWheel', () => {
  const out = convertToWheel('hub', nodes, edges)!;

  it('таблетки внутри круга уходят; фигуры внутри, не таблетки, и таблетка снаружи остаются', () => {
    expect(out.nodes.map((n) => n.id).sort()).toEqual(['far', 'hub', 'inside', 's']);
  });

  it('круг становится колесом с центром на месте центра круга; заметка таблетки — в «Сейчас»', () => {
    const w = out.nodes.find((n) => n.id === 'hub')!;
    expect(w.data.wheel).toEqual({ period: 'now', notes: { now: { attachment: 'Ищет близости' } } });
    expect(w.position).toEqual({ x: 170 - WHEEL_NODE_W / 2, y: 170 - WHEEL_CENTER_Y });
  });

  it('линии к таблеткам переходят к сектору своей потребности, в обе стороны; подпись линии сохраняется', () => {
    const byId = new Map(out.edges.map((e) => [e.id, e]));
    expect(byId.get('e1')).toMatchObject({ source: 's', target: 'hub', targetHandle: 'need:attachment', label: '✗' });
    expect(byId.get('e2')).toMatchObject({ source: 'hub', sourceHandle: 'need:play', target: 's' });
    expect(byId.get('e3')).toMatchObject({ source: 's', target: 'far' });
  });

  it('линия между двумя таблетками одного круга исчезает (стала петлёй), дубли схлопываются', () => {
    const dup = convertToWheel('hub', nodes, [...edges, { id: 'loop', source: 'p1', target: 'p2' }, { id: 'e1b', source: 's', target: 'p1' }])!;
    expect(dup.edges.map((e) => e.id).sort()).toEqual(['e1', 'e2', 'e3', 'loop'].filter((id) => id !== 'loop').sort());
  });

  it('не круг — null', () => {
    expect(convertToWheel('s', nodes, edges)).toBeNull();
    expect(convertToWheel('nope', nodes, edges)).toBeNull();
  });
});
