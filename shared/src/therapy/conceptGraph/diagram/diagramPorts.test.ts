import { describe, it, expect } from 'vitest';
import { portPoint, spreadU } from './diagramPorts';
import type { DiagramNode, DiagramShape } from './diagramTypes';

const node = (shape: DiagramShape): DiagramNode => ({
  id: 'n',
  kind: 'mode',
  shape,
  x: 100,
  y: 200,
  w: 168,
  h: 80,
  label: 'x',
  color: 'var(--accent)',
});

describe('portPoint', () => {
  it('плоские фигуры касаются рамки в любой точке стороны', () => {
    for (const shape of ['octagon', 'pill', 'rounded'] as const) {
      expect(portPoint(node(shape), 'top', 0.3).y).toBe(200);
      expect(portPoint(node(shape), 'bottom', 0.7).y).toBe(280);
    }
  });

  it('x — доля ширины от левого края', () => {
    expect(portPoint(node('rounded'), 'top', 0.5).x).toBe(184);
    expect(portPoint(node('rounded'), 'top', 0.25).x).toBe(142);
  });

  it('эллипс: в центре стрелка касается рамки, к краю — входит внутрь рамки по контуру', () => {
    expect(portPoint(node('ellipse'), 'top', 0.5).y).toBe(200);
    const off = portPoint(node('ellipse'), 'top', 0.78);
    expect(off.y).toBeGreaterThan(200);
    // точка лежит на эллипсе: ((x - cx) / rx)² + ((y - cy) / ry)² = 1
    const nx = (off.x - 184) / 84;
    const ny = (off.y - 240) / 40;
    expect(nx * nx + ny * ny).toBeCloseTo(1, 5);
  });

  it('пятиугольник: вершина сверху у рамки, к краям контур уходит вниз', () => {
    const apex = portPoint(node('pentagon'), 'top', 0.5).y;
    expect(apex).toBeCloseTo(201.6, 1);
    expect(portPoint(node('pentagon'), 'top', 0.4).y).toBeGreaterThan(apex);
  });
});

describe('spreadU', () => {
  it('одна линия — по центру, несколько — веером в порядке очереди', () => {
    expect(spreadU('rounded', 'top', 0, 1)).toBe(0.5);
    const three = [0, 1, 2].map((i) => spreadU('rounded', 'top', i, 3));
    expect(three).toEqual([0.3, 0.5, 0.7]);
  });

  it('вершина пятиугольника принимает линии в узком коридоре', () => {
    const [a, b] = [0, 1].map((i) => spreadU('pentagon', 'top', i, 2));
    expect(b - a).toBeCloseTo(0.2, 5);
    expect(
      spreadU('pentagon', 'bottom', 1, 2) - spreadU('pentagon', 'bottom', 0, 2),
    ).toBeCloseTo(0.4, 5);
  });
});
