import { describe, expect, it } from 'vitest';
import { GLYPHS, glyphRects, glyphSize, type GlyphName } from './glyphs';

describe('пиксельные значки', () => {
  it('каждый битмап — прямоугольник из «#» и «.», с закрашенными пикселями', () => {
    for (const name of Object.keys(GLYPHS) as GlyphName[]) {
      const rows = GLYPHS[name];
      expect(rows.every(r => r.length === rows[0].length && /^[#.]+$/.test(r))).toBe(true);
      expect(glyphRects(name).length).toBeGreaterThan(0);
    }
  });
  it('размер — число клеток × масштаб', () => {
    expect(glyphSize('heart', 3)).toEqual({ w: 21, h: 18 });
  });
});
