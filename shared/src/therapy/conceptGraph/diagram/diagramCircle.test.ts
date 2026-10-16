import { describe, it, expect } from 'vitest';
import { NEED_ORDER } from '../../../needs/needData';
import { NEED_SLOT, PILL_H, circleGeometry } from './diagramCircle';

describe('circleGeometry', () => {
  const g = circleGeometry(340, { x: 500, y: 300 });

  it('пять таблеток в порядке NEED_ORDER с названиями потребностей', () => {
    expect(g.needs.map((n) => n.needId)).toEqual([...NEED_ORDER]);
    expect(g.needs.map((n) => n.label)).toEqual([
      'Привязанность',
      'Автономия',
      'Выражение чувств',
      'Спонтанность',
      'Границы',
    ]);
    expect(g.needs.every((n) => n.h === PILL_H && n.kind === 'need')).toBe(
      true,
    );
  });

  it('раскладка 2–1–2: два ряда по две таблетки и одна широкая посередине, всё симметрично центру', () => {
    const by = (id: string) => g.needs.find((n) => n.needId === id)!;
    expect(by('attachment').y).toBe(by('autonomy').y);
    expect(by('play').y).toBe(by('limits').y);
    expect(by('expression').y).toBeGreaterThan(by('attachment').y);
    expect(by('expression').y).toBeLessThan(by('play').y);
    expect(by('expression').w).toBeGreaterThan(by('attachment').w);
    const cx = (n: { x: number; w: number }) => n.x + n.w / 2;
    expect(cx(by('expression'))).toBeCloseTo(500, 5);
    expect(cx(by('attachment')) + cx(by('autonomy'))).toBeCloseTo(1000, 5);
    expect(NEED_SLOT.expression).toEqual({ row: 1, col: 'C' });
  });

  it('зазоры между рядами лежат строго между таблетками, подпись выше таблеток', () => {
    const by = (id: string) => g.needs.find((n) => n.needId === id)!;
    expect(g.bands[0]).toBeGreaterThan(by('attachment').y + PILL_H);
    expect(g.bands[0]).toBeLessThan(by('expression').y);
    expect(g.bands[1]).toBeGreaterThan(by('expression').y + PILL_H);
    expect(g.bands[1]).toBeLessThan(by('play').y);
    expect(g.titleY).toBeLessThan(by('attachment').y);
    expect(g.circle).toEqual({
      cx: 500,
      cy: 300,
      r: 170,
      title: 'Базовые эмоциональные потребности',
    });
  });
});
