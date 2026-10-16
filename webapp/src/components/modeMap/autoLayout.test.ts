import { describe, expect, it } from 'vitest';
import type { Node, Edge } from '@xyflow/react';
import { autoLayout } from './autoLayout';

type FlowNode = Node<Record<string, unknown>>;

const node = (id: string, type: string, x: number, y: number, data: Record<string, unknown> = {}): FlowNode =>
  ({ id, type, position: { x, y }, data });
const edge = (source: string, target: string): Edge<Record<string, unknown>> =>
  ({ id: `${source}-${target}`, source, target });

describe('autoLayout с кругом потребностей', () => {
  // Круг 340 в (1000, 1000), центр (1170, 1170); две потребности внутри,
  // схема далеко слева, Здоровый Взрослый справа.
  const hub = node('hub', 'needs', 1000, 1000, { diameter: 340 });
  const inA = node('a', 'need', 1100, 1100);
  const inB = node('b', 'need', 1180, 1200);
  const schema = node('s', 'schema', -500, 0);
  const healthy = node('h', 'healthy', 3000, 0);
  const out = autoLayout([hub, inA, inB, schema, healthy], [edge('s', 'a'), edge('h', 'b')]);
  const at = (id: string) => out.find((n) => n.id === id)!.position;

  it('потребности едут за кругом с тем же смещением', () => {
    expect(at('a').x - at('hub').x).toBe(100);
    expect(at('a').y - at('hub').y).toBe(100);
    expect(at('b').x - at('hub').x).toBe(180);
    expect(at('b').y - at('hub').y).toBe(200);
  });

  it('линия к потребности считается линией к кругу: схема левее круга', () => {
    expect(at('s').x + 150).toBeLessThanOrEqual(at('hub').x);
  });

  it('контроль: нода вне круга раскладывается сама, а не едет за кругом', () => {
    expect(at('h')).not.toEqual({ x: 3000, y: 0 });
    expect(at('hub')).not.toEqual({ x: 1000, y: 1000 });
  });

  it('без круга — обычная раскладка: потребности расставляются по отдельности', () => {
    const res = autoLayout([inA, inB], [edge('a', 'b')]);
    expect(res[1].position.x).toBeGreaterThan(res[0].position.x);
    expect(res[1].position.x - res[0].position.x).not.toBe(80);
  });
});
