// getEdgeParams — точки, где линия касается контура фигуры. Для схемы случая:
// схема — прямоугольник, овал опыта и таблетка потребности — эллипс, круг
// потребностей — круг. Различаем по направлению вдоль длинной стороны: там
// прямоугольник и эллипс расходятся на десятки пикселей.
import { describe, it, expect } from 'vitest';
import { getEdgeParams } from './edgeGeometry';

function fake(type: string, x: number, y: number, w: number, h: number, data: Record<string, unknown> = {}) {
  return { type, data, measured: { width: w, height: h }, internals: { positionAbsolute: { x, y } } } as never;
}
const FAR = (x: number, y: number) => fake('custom', x - 5, y - 5, 10, 10);

describe('getEdgeParams — фигуры схемы случая', () => {
  // Широкая фигура 300×40 в (0,0), центр (150,20); собеседник сильно правее и чуть ниже.
  const other = FAR(450, 40);

  it('схема: линия упирается в рамку (правый край прямоугольника)', () => {
    const { sx } = getEdgeParams(fake('schema', 0, 0, 300, 40), other);
    expect(sx).toBeGreaterThan(297);
    expect(sx).toBeLessThanOrEqual(300);
  });

  it('таблетка потребности: линия упирается в эллипс, раньше края рамки', () => {
    const { sx, sy } = getEdgeParams(fake('need', 0, 0, 300, 40), other);
    expect(sx).toBeGreaterThan(280);
    expect(sx).toBeLessThan(288);
    // точка лежит на эллипсе, а не в углу рамки (допуск на отступ в 1px от контура)
    const e = ((sx - 150) / 150) ** 2 + ((sy - 20) / 20) ** 2;
    expect(e).toBeGreaterThan(0.97);
    expect(e).toBeLessThan(1);
  });

  it('овал опыта — тоже эллипс', () => {
    const { sx } = getEdgeParams(fake('origin', 0, 0, 300, 40), other);
    expect(sx).toBeLessThan(288);
  });

  it('круг потребностей: по диагонали линия касается окружности, а не угла квадрата', () => {
    const hub = fake('needs', 0, 0, 340, 340);
    const { sx, sy } = getEdgeParams(hub, FAR(470, 470));
    const r = Math.hypot(sx - 170, sy - 170);
    expect(r).toBeGreaterThan(168);
    expect(r).toBeLessThan(170);
    expect(sx).toBeLessThan(300); // угол квадрата был бы на 340
  });

  it('концы считаются с обеих сторон: от схемы к таблетке и обратно', () => {
    const schema = fake('schema', 0, 0, 200, 80);
    const pill = fake('need', 500, 0, 120, 40);
    const { sx, tx } = getEdgeParams(schema, pill);
    expect(sx).toBeGreaterThan(197);
    expect(tx).toBeGreaterThan(500);
    expect(tx).toBeLessThan(520);
  });
});
