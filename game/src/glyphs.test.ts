import { describe, expect, it } from 'vitest';
import { GLYPHS, glyphRects, glyphSize, setHearts, type GlyphName } from './glyphs';

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

describe('setHearts — слоты по числу жизней', () => {
  const mk = (n: number) => Array.from({ length: n }, () => {
    const img = { tex: '', vis: true, setTexture(k: string) { this.tex = k; return this; }, setVisible(v: boolean) { this.vis = v; return this; } };
    return img;
  });
  const scene = { textures: { exists: () => true } };
  it('полные до n, остальные тёмные; больше трёх слотов прячутся при малом n', () => {
    const imgs = mk(5);
    setHearts(scene as never, imgs as never, 2);
    expect(imgs.map(i => i.tex === imgs[0].tex)).toEqual([true, true, false, false, false]);
    expect(imgs.map(i => i.vis)).toEqual([true, true, true, false, false]);
    setHearts(scene as never, imgs as never, 5);
    expect(imgs.every(i => i.vis && i.tex === imgs[0].tex)).toBe(true);
  });
});
