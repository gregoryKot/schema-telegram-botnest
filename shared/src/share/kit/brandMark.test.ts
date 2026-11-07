// Знак продукта на canvas и в файле иконки (brandMark.ts): полный — с полоской фона,
// простой (16–24 px) — без неё; дуга — те же 276° с разрывом вверху справа, что в SVG.
// Сверка favicon.svg и цветов с токенами — webapp/src/components/art/BrandMark.test.tsx.
import { describe, it, expect } from 'vitest';
import {
  ARC,
  ARC_D,
  BRAND_HEX,
  STRIPE,
  brandMarkSvg,
  drawBrandMark,
} from './brandMark';
import { mockCardCtx } from '../cards/canvas.test-helpers';

const draw = (simple: boolean) => {
  const ctx = mockCardCtx();
  drawBrandMark(ctx as unknown as CanvasRenderingContext2D, 10, 20, 64, simple);
  return ctx;
};

describe('drawBrandMark', () => {
  it('полный: плитка, полоска через всю высоту, дуга и круг; состояние контекста вернули', () => {
    const ctx = draw(false);
    expect(ctx.roundRect).toHaveBeenCalledWith(10, 20, 64, 64, 14);
    expect(ctx.moveTo).toHaveBeenCalledTimes(1);
    expect(ctx.lineTo).toHaveBeenCalledTimes(STRIPE.length - 1);
    expect(ctx.lineTo).toHaveBeenLastCalledWith(10 + 186 / 8, 20 + 64);
    const [arc, core] = ctx.arc.mock.calls;
    expect(arc[3]).toBeCloseTo((ARC.from * Math.PI) / 180);
    expect(arc[4]).toBeCloseTo((ARC.to * Math.PI) / 180);
    expect(core[4]).toBeCloseTo(Math.PI * 2);
    expect(ctx.save).toHaveBeenCalledTimes(1);
    expect(ctx.restore).toHaveBeenCalledTimes(1);
  });

  it('простой: без полоски, дуга толще на растре, чем у полного', () => {
    const simple = draw(true);
    expect(simple.moveTo).not.toHaveBeenCalled();
    expect(simple.lineTo).not.toHaveBeenCalled();
    expect(simple.lineWidth).toBeGreaterThan(draw(false).lineWidth);
  });
});

describe('brandMarkSvg', () => {
  it('полный — со скруглённой плиткой и полоской шалфея, простой — без полоски', () => {
    const full = brandMarkSvg();
    expect(full).toContain(`rx="112"`);
    expect(full).toContain(`fill="${BRAND_HEX.sage}"`);
    expect(full).toContain(`d="${ARC_D}"`);
    expect(brandMarkSvg({ simple: true })).not.toContain(BRAND_HEX.sage);
  });

  it('bleed — квадрат без скругления (маску накладывает система)', () => {
    expect(brandMarkSvg({ bleed: true })).not.toContain('rx=');
  });

  it('дуга в SVG — та же, что выбрал владелец (вариант Б)', () => {
    expect(ARC_D).toBe('M367.9 237.7 A124 124 0 1 1 224.2 154.7');
  });
});
