import { describe, it, expect } from 'vitest';
import { countedDrawing } from './countedSigns';
import { CANVAS_SIGNS } from './signTable';

describe('countedDrawing — вариант мотива по счёту', () => {
  it('пять полосок — та же геометрия, что у знака Strokes', () => {
    expect(countedDrawing('strokes', 5)).toEqual(CANVAS_SIGNS.strokes);
  });

  it.each([2, 3, 4, 7])('%i полосок — по центру холста, не шире него', (n) => {
    const d = countedDrawing('strokes', n);
    const rects = (d?.prims ?? []).map((p) => (p.t === 'rect' ? p : null));
    expect(rects).toHaveLength(n);
    const left = rects[0]!.x;
    const right = 120 - (rects[n - 1]!.x + rects[n - 1]!.w);
    expect(left).toBeGreaterThanOrEqual(0);
    expect(left).toBeCloseTo(right);
  });

  it('листы: 2 и 4 веером, крайние повёрнуты как у Sheets', () => {
    const four = countedDrawing('sheets', 4)!.prims;
    expect(four).toHaveLength(4);
    expect(four[0].rot?.[0]).toBe(-12);
    expect(four[3].rot?.[0]).toBe(6);
    expect(countedDrawing('sheets', 2)!.prims).toHaveLength(2);
  });

  it('камешки: три легли — знак Pebbles; один — два гнезда с кромкой своего цвета', () => {
    expect(countedDrawing('pebbles', 3)).toEqual(CANVAS_SIGNS.pebbles);
    const one = countedDrawing('pebbles', 1)!.prims;
    expect(one.map((p) => p.fill)).toEqual(['moss', 'hollow', 'hollow']);
    expect(one.map((p) => (p.t === 'ellipse' ? p.stroke : null))).toEqual([
      undefined,
      'brown',
      'clay',
    ]);
  });

  it('знак без варианта, число вне диапазона, ключ прототипа — null', () => {
    expect(countedDrawing('leaf', 3)).toBeNull();
    expect(countedDrawing('strokes', undefined)).toBeNull();
    expect(countedDrawing('strokes', 1)).toBeNull();
    expect(countedDrawing('sheets', 5)).toBeNull();
    expect(countedDrawing('toString', 3)).toBeNull();
  });
});
