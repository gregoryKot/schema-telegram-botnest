import { describe, it, expect } from 'vitest';
import { outline, portPoint, spreadU, type Side } from './diagramPorts';
import type { DiagramNode, DiagramShape } from './diagramTypes';

const node = (shape: DiagramShape): DiagramNode => ({
  id: 'n',
  kind: 'mode',
  shape,
  section: 'modes',
  x: 100,
  y: 200,
  w: 200,
  h: 100,
  label: 'x',
  color: 'var(--accent)',
});

const SHAPES: DiagramShape[] = [
  'ellipse',
  'octagon',
  'pentagon',
  'shield',
  'pill',
  'rounded',
];

describe('portPoint', () => {
  it('прямоугольник: порт лежит на рамке в любой точке стороны', () => {
    expect(portPoint(node('rounded'), 'top', 0.3)).toEqual({ x: 160, y: 200 });
    expect(portPoint(node('rounded'), 'bottom', 0.7)).toEqual({
      x: 240,
      y: 300,
    });
    expect(portPoint(node('rounded'), 'left', 0.25)).toEqual({
      x: 100,
      y: 225,
    });
    expect(portPoint(node('rounded'), 'right', 0.75)).toEqual({
      x: 300,
      y: 275,
    });
  });

  it('эллипс: в центре стороны порт на рамке, к краю уходит внутрь рамки', () => {
    const e = node('ellipse');
    expect(portPoint(e, 'top', 0.5).y).toBeCloseTo(200, 0);
    expect(portPoint(e, 'right', 0.5).x).toBeCloseTo(300, 0);
    expect(portPoint(e, 'top', 0.2).y).toBeGreaterThan(210);
    expect(portPoint(e, 'left', 0.2).x).toBeGreaterThan(110);
  });

  it('пятиугольник: вершина сверху, плоское основание снизу', () => {
    const p = node('pentagon');
    expect(portPoint(p, 'top', 0.5).y).toBeCloseTo(202, 0);
    expect(portPoint(p, 'bottom', 0.5).y).toBeCloseTo(292.4, 0);
    expect(portPoint(p, 'top', 0.3).y).toBeGreaterThan(
      portPoint(p, 'top', 0.5).y,
    );
  });

  it('каждый порт каждой фигуры лежит на контуре: внутри рамки и не дальше от центра, чем рамка', () => {
    for (const shape of SHAPES) {
      for (const side of ['top', 'bottom', 'left', 'right'] as Side[]) {
        for (const u of [0.3, 0.5, 0.7]) {
          const n = node(shape);
          const p = portPoint(n, side, u);
          expect(p.x).toBeGreaterThanOrEqual(n.x - 0.01);
          expect(p.x).toBeLessThanOrEqual(n.x + n.w + 0.01);
          expect(p.y).toBeGreaterThanOrEqual(n.y - 0.01);
          expect(p.y).toBeLessThanOrEqual(n.y + n.h + 0.01);
        }
      }
    }
  });

  it('порт лежит на своей стороне: левый левее центра, правый правее, верхний выше, нижний ниже', () => {
    for (const shape of SHAPES) {
      const n = node(shape);
      const cx = n.x + n.w / 2;
      const cy = n.y + n.h / 2;
      expect(portPoint(n, 'left', 0.5).x).toBeLessThan(cx);
      expect(portPoint(n, 'right', 0.5).x).toBeGreaterThan(cx);
      expect(portPoint(n, 'top', 0.5).y).toBeLessThan(cy);
      expect(portPoint(n, 'bottom', 0.5).y).toBeGreaterThan(cy);
    }
  });
});

describe('outline', () => {
  it('у каждой фигуры контур — замкнутый многоугольник внутри своей рамки', () => {
    for (const shape of SHAPES) {
      const poly = outline(shape, 200, 100);
      expect(poly.length).toBeGreaterThanOrEqual(4);
      for (const p of poly) {
        expect(p.x).toBeGreaterThanOrEqual(-0.01);
        expect(p.x).toBeLessThanOrEqual(200.01);
        expect(p.y).toBeGreaterThanOrEqual(-0.01);
        expect(p.y).toBeLessThanOrEqual(100.01);
      }
    }
  });
});

describe('spreadU', () => {
  it('одна линия — по центру, несколько — веером от меньшего к большему, внутри стороны', () => {
    expect(spreadU('rounded', 'right', 0, 1)).toBeCloseTo(0.5, 5);
    const fan = [0, 1, 2].map((i) => spreadU('rounded', 'right', i, 3));
    expect(fan[0]).toBeLessThan(fan[1]);
    expect(fan[1]).toBeLessThan(fan[2]);
    expect(fan[0]).toBeGreaterThan(0.2);
    expect(fan[2]).toBeLessThan(0.8);
  });

  it('у вершины пятиугольника веер уже, чем у прямоугольника', () => {
    const span = (shape: DiagramShape) =>
      spreadU(shape, 'top', 1, 2) - spreadU(shape, 'top', 0, 2);
    expect(span('pentagon')).toBeLessThan(span('rounded'));
  });
});
